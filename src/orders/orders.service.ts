import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // ✅ Corrected path
import { AuditService } from '../admin/audit/audit.service';
import { OrderStatus } from '@prisma/client'; // ✅ Prisma enum

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // 🧾 CUSTOMER PLACES ORDER
  // ------------------------------------------------------------------
  async createOrder(
    userId: number,
    pharmacyId: number | null,
    items: { medicineId: number; quantity: number }[],
    customerLat?: number,
    customerLng?: number,
  ) {
    if (!items?.length)
      throw new BadRequestException('At least one medicine is required');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (pharmacyId) {
      this.logger.log(`🛍️ User #${userId} placed direct order to Pharmacy #${pharmacyId}`);
      return this.createDirectOrder(userId, pharmacyId, items);
    }

    this.logger.log(`📡 Broadcasting order from User #${userId} to nearby pharmacies`);
    return this.createBroadcastOrder(user, items, customerLat, customerLng);
  }

  // ------------------------------------------------------------------
  // 🏥 DIRECT ORDER FLOW
  // ------------------------------------------------------------------
  private async createDirectOrder(
    userId: number,
    pharmacyId: number,
    items: { medicineId: number; quantity: number }[],
  ) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      include: { medicines: true },
    });
    if (!pharmacy) throw new BadRequestException('Pharmacy not found');

    const orderItems = items.map((i) => {
      const med = pharmacy.medicines.find((m) => m.id === i.medicineId);
      if (!med) throw new BadRequestException(`Medicine ${i.medicineId} not found`);
      if (i.quantity > med.stock)
        throw new BadRequestException(`Insufficient stock for ${med.name}`);
      return { medicineId: med.id, quantity: i.quantity, price: med.price };
    });

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of orderItems) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return tx.order.create({
        data: {
          userId,
          pharmacyId,
          status: OrderStatus.pending, // ✅ enum
          items: { create: orderItems },
        },
        include: { pharmacy: true, items: { include: { medicine: true } } },
      });
    });

    await this.logOrderEvent(order.id, 'Order Created', 'customer', userId);
    await this.auditService.record(userId, 'customer', 'Created Order', 'Order', order.id);
    this.logger.log(`✅ Order #${order.id} created for Pharmacy #${pharmacyId}`);

    await this.sendNotification('pharmacy', pharmacyId, {
      title: '🆕 New Order Received',
      message: `Order #${order.id} has been placed by a customer.`,
    });

    return order;
  }

  // ------------------------------------------------------------------
  // 🛰️ BROADCAST ORDER FLOW
  // ------------------------------------------------------------------
  private async createBroadcastOrder(
    user: any,
    items: { medicineId: number; quantity: number }[],
    customerLat?: number,
    customerLng?: number,
  ) {
    const pharmacies = await this.prisma.pharmacy.findMany({ include: { medicines: true } });

    const eligible = pharmacies.filter((p) =>
      items.every((i) => {
        const m = p.medicines.find((x) => x.id === i.medicineId);
        return m && m.stock >= i.quantity;
      }),
    );

    if (!eligible.length)
      throw new BadRequestException('No pharmacy has all requested medicines');

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        status: OrderStatus.awaiting_pharmacy_acceptance, // ✅ enum
        items: {
          create: items.map((i) => ({
            medicineId: i.medicineId,
            quantity: i.quantity,
            price: 0,
          })),
        },
      },
    });

    await this.prisma.orderPharmacyRequest.createMany({
      data: eligible.map((p) => ({ orderId: order.id, pharmacyId: p.id })),
    });

    for (const p of eligible) {
      await this.sendNotification('pharmacy', p.id, {
        title: '📦 New Order Opportunity',
        message: `Order #${order.id} is waiting for acceptance.`,
      });
    }

    await this.logOrderEvent(order.id, 'Order Broadcasted', 'system', null, `${eligible.length} pharmacies pinged.`);
    await this.auditService.record(user.id, 'customer', 'Broadcasted Order', 'Order', order.id);
    this.logger.log(`📢 Broadcasted Order #${order.id} to ${eligible.length} pharmacies.`);
    return { message: 'Order broadcasted successfully', orderId: order.id };
  }

  // ------------------------------------------------------------------
  // 🏥 PHARMACY RESPONSE
  // ------------------------------------------------------------------
  async pharmacyRespond(orderId: number, pharmacyId: number, decision: 'accept' | 'reject') {
    const req = await this.prisma.orderPharmacyRequest.findFirst({ where: { orderId, pharmacyId } });
    if (!req) throw new NotFoundException('Order request not found');

    await this.prisma.orderPharmacyRequest.update({
      where: { id: req.id },
      data: { status: decision === 'accept' ? 'accepted' : 'rejected' },
    });

    if (decision === 'reject') {
      await this.logOrderEvent(orderId, 'Pharmacy Rejected', 'pharmacy', pharmacyId);
      await this.auditService.record(pharmacyId, 'pharmacy', 'Rejected Order', 'Order', orderId);
      this.logger.log(`🚫 Pharmacy #${pharmacyId} rejected Order #${orderId}`);
      return { message: 'Order rejected' };
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { pharmacyId, status: OrderStatus.accepted }, // ✅ enum
      include: { pharmacy: true },
    });

    await this.logOrderEvent(orderId, 'Pharmacy Accepted', 'pharmacy', pharmacyId);
    await this.auditService.record(pharmacyId, 'pharmacy', 'Accepted Order', 'Order', orderId);
    await this.notifyNearbyRiders(orderId, pharmacyId);
    return { message: 'Pharmacy accepted and riders notified', order: updated };
  }

  // ------------------------------------------------------------------
  // 🚴 RIDER RESPONDS (accept / reject)
  // ------------------------------------------------------------------
  async riderRespond(orderId: number, riderId: number, decision: 'accept' | 'reject') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const req = await this.prisma.orderRiderRequest.findFirst({
      where: { orderId, riderId },
    });
    if (!req) throw new NotFoundException('No pending request found for this rider');

    if (decision === 'reject') {
      await this.prisma.orderRiderRequest.update({
        where: { id: req.id },
        data: { status: 'rejected' },
      });

      await this.logOrderEvent(orderId, 'Rider Rejected', 'rider', riderId);
      await this.auditService.record(riderId, 'rider', 'Rejected Delivery', 'Order', orderId);
      this.logger.log(`🚫 Rider #${riderId} rejected Order #${orderId}`);
      return { message: 'Rider rejected order' };
    }

    const alreadyAccepted = await this.prisma.orderRiderRequest.findFirst({
      where: { orderId, status: 'accepted' },
    });
    if (alreadyAccepted) {
      await this.prisma.orderRiderRequest.update({
        where: { id: req.id },
        data: { status: 'expired' },
      });
      this.logger.log(`⌛ Rider #${riderId} tried to accept but order already taken.`);
      return { message: 'Order already accepted by another rider' };
    }

    await this.prisma.orderRiderRequest.update({
      where: { id: req.id },
      data: { status: 'accepted' },
    });

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { riderId, status: OrderStatus.pending }, // ✅ enum
      include: { pharmacy: true },
    });

    await this.prisma.orderRiderRequest.updateMany({
      where: { orderId, riderId: { not: riderId }, status: 'pending' },
      data: { status: 'expired' },
    });

    await this.logOrderEvent(orderId, 'Rider Accepted', 'rider', riderId);
    await this.auditService.record(riderId, 'rider', 'Accepted Delivery', 'Order', orderId);

    if (updatedOrder.pharmacyId) {
      await this.sendNotification('pharmacy', updatedOrder.pharmacyId, {
        title: '🚴 Rider Assigned',
        message: `Order #${orderId} is being picked up by a rider.`,
      });
    }

    this.logger.log(`✅ Rider #${riderId} accepted and assigned to Order #${orderId}`);
    return { message: 'Order assigned to this rider', order: updatedOrder };
  }

  // ------------------------------------------------------------------
  // 🚴 NOTIFY RIDERS (simulation)
  // ------------------------------------------------------------------
  private async notifyNearbyRiders(orderId: number, pharmacyId: number) {
    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy?.latitude || !pharmacy?.longitude) return;

    const riders = await this.prisma.rider.findMany({ where: { isAvailable: true } });
    const nearby = riders
      .map((r) => ({
        rider: r,
        distance: this.getDistance(pharmacy.latitude!, pharmacy.longitude!, r.latitude ?? 0, r.longitude ?? 0),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    await this.prisma.orderRiderRequest.createMany({
      data: nearby.map((r) => ({ orderId, riderId: r.rider.id })),
    });

    for (const r of nearby) {
      await this.sendNotification('rider', r.rider.id, {
        title: '🚚 New Delivery Available',
        message: `Order #${orderId} is nearby (${r.distance.toFixed(1)} km)`,
      });
    }

    await this.logOrderEvent(orderId, 'Riders Notified', 'system');
    this.logger.log(`📢 Notified ${nearby.length} riders for Order #${orderId}`);
  }

  // ------------------------------------------------------------------
  // 📍 DISTANCE CALCULATION
  // ------------------------------------------------------------------
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // ------------------------------------------------------------------
  // 🧾 ORDER LOGGING
  // ------------------------------------------------------------------
  private async logOrderEvent(orderId: number, action: string, actorType: string, actorId?: number | null, details?: string) {
    try {
      await this.prisma.orderLog.create({ data: { orderId, actorType, actorId: actorId ?? null, action, details } });
    } catch (err) {
      this.logger.error(`OrderLog failed: ${err?.message ?? err}`);
    }
  }

  // ------------------------------------------------------------------
  // 🔔 UNIVERSAL NOTIFICATION HANDLER
  // ------------------------------------------------------------------
  private async sendNotification(
    targetType: 'rider' | 'pharmacy' | 'admin',
    targetId: number,
    payload: { title: string; message: string },
  ) {
    if (!targetId) return;

    this.logger.log(
      `🔔 Notification → ${targetType.toUpperCase()} #${targetId}\nTitle: ${payload.title}\nMessage: ${payload.message}`,
    );

    try {
      await this.prisma.notification.create({
        data: {
          targetType,
          targetId,
          title: payload.title,
          message: payload.message,
        },
      });
    } catch (err) {
      this.logger.warn(`⚠️ Notification DB log failed for ${targetType} #${targetId}: ${err?.message ?? err}`);
    }
  }

  // ------------------------------------------------------------------
  // 🔍 ADMIN: GET ALL ORDERS
  // ------------------------------------------------------------------
  async getOrders() {
    return this.prisma.order.findMany({
      include: {
        user: true,
        pharmacy: true,
        rider: true,
        items: { include: { medicine: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ------------------------------------------------------------------
  // 🧭 ADMIN: MANUAL RIDER ASSIGN
  // ------------------------------------------------------------------
  async assignRider(orderId: number, riderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider not found');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { riderId },
      include: { rider: true },
    });

    await this.auditService.record(riderId, 'admin', 'Rider Manually Assigned', 'Order', orderId);
    await this.sendNotification('rider', riderId, {
      title: '🧭 Delivery Assigned',
      message: `Order #${orderId} was assigned to you by admin.`,
    });

    return updated;
  }

  // ------------------------------------------------------------------
  // 🔄 ADMIN: UPDATE STATUS
  // ------------------------------------------------------------------
  async updateOrderStatus(orderId: number, status: string) {
    const valid = Object.values(OrderStatus) as string[]; // ✅ use enum values
    if (!valid.includes(status)) throw new BadRequestException('Invalid status');

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as OrderStatus }, // ✅ cast to Prisma enum
      include: { pharmacy: true },
    });

    await this.auditService.record(null, 'system', `Status Updated → ${status}`, 'Order', orderId);
    await this.logOrderEvent(orderId, `Status → ${status}`, 'system');

    if (updated.pharmacyId) {
      await this.sendNotification('pharmacy', updated.pharmacyId, {
        title: '📦 Order Status Changed',
        message: `Order #${orderId} is now ${status.toUpperCase()}.`,
      });
    }

    return updated;
  }

  // ------------------------------------------------------------------
  // 🚴 RIDER: GET ORDERS
  // ------------------------------------------------------------------
  async getOrdersByRider(riderId: number) {
    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider not found');

    return this.prisma.order.findMany({
      where: { riderId },
      include: { user: true, pharmacy: true, items: { include: { medicine: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
