// src/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
    private config: ConfigService,
    @Inject('ORDER_ASSIGN_QUEUE') private orderAssignQueue: Queue,
  ) {}

  // 🛒 Create new order
  async createOrder(customerId: number, dto: CreateOrderDto) {
    // ✅ Safe ID validation
    if (!customerId || isNaN(Number(customerId))) {
      throw new BadRequestException('Invalid or missing customer ID.');
    }

    if (!dto.items?.length)
      throw new BadRequestException('No items provided.');

    const total = dto.items.reduce((s, it) => s + it.price * it.quantity, 0);

    // ----- Direct pharmacy target -----
    if (dto.pharmacyId) {
      const pharmacy = await this.prisma.user.findUnique({
        where: { id: dto.pharmacyId },
      });
      if (!pharmacy || pharmacy.role !== 'PHARMACY')
        throw new NotFoundException('Pharmacy not found.');

      const order = await this.prisma.order.create({
        data: {
  customer: { connect: { id: Number(customerId) } },
  pharmacy: { connect: { id: dto.pharmacyId } },
  totalPrice: total,
  status: 'PENDING',
  items: {
    create: dto.items.map((it) => ({
      medicineId: it.medicineId ?? undefined,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
    })),
  },
},
        include: { items: true },
      });

      await this.notify.create(
        dto.pharmacyId,
        'ORDER_PLACED',
        `New order #${order.id}`,
        { orderId: order.id },
        customerId,
      );
      this.ws.notifyUser(dto.pharmacyId, 'order_placed', order);

      this.notify.sendAdminToast?.({
        type: 'info',
        title: 'New Order',
        text: `Order #${order.id} placed for ${pharmacy.email}`,
      });

      return order;
    }

    // ----- Broadcast by medicine IDs -----
    const medicineIds: number[] = dto.items
      .map((i) => i.medicineId)
      .filter((id): id is number => typeof id === 'number' && !isNaN(id));

    if (!medicineIds.length)
      throw new BadRequestException('No valid medicine IDs.');

    const candidates = await this.prisma.pharmacyInventory.groupBy({
      by: ['pharmacyId'],
      where: {
        medicineId: { in: medicineIds },
        stock: { gt: 0 },
      },
      _count: {
        medicineId: true,
      },
    });

    const pharmacyIds = candidates
      .filter((c) => c._count?.medicineId === medicineIds.length)
      .map((c) => c.pharmacyId);

    if (!pharmacyIds.length)
      throw new NotFoundException('No pharmacies with stock.');

    const order = await this.prisma.order.create({
      data: {
  customer: { connect: { id: Number(customerId) } },
  pharmacy: { connect: { id: pharmacyIds[0] } },
  totalPrice: total,
  status: 'PENDING',
  items: {
    create: dto.items.map((it) => ({
      medicineId: it.medicineId ?? undefined,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
    })),
  },
},
      include: { items: true },
    });

    for (const pid of pharmacyIds) {
      await this.prisma.orderOffer.create({
        data: { orderId: order.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
      });
      await this.notify.create(
        pid,
        'ORDER_AVAILABLE',
        `Order #${order.id} available to accept.`,
        { orderId: order.id },
        customerId,
      );
      this.ws.notifyUser(pid, 'order_available', { orderId: order.id });
    }

    this.notify.sendAdminToast?.({
      type: 'ok',
      title: 'Order Broadcasted',
      text: `Order #${order.id} offered to ${pharmacyIds.length} pharmacies.`,
    });

    return { order, candidates: pharmacyIds };
  }

  // ✅ Pharmacy response
  async pharmacyRespond(
    pharmacyId: number,
    orderId: number,
    action: 'ACCEPTED' | 'REJECTED',
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'PENDING')
      throw new BadRequestException('Order not pending.');

    await this.prisma.orderOffer.updateMany({
      where: { orderId, pharmacyId },
      data: { status: action },
    });

    if (action === 'REJECTED') {
      await this.notify.create(
        order.customerId,
        'ORDER_REJECTED_BY_PHARMACY',
        `Order #${orderId} rejected by pharmacy ${pharmacyId}`,
        { orderId },
        pharmacyId,
      );
      this.notify.sendAdminToast?.({
        type: 'err',
        title: 'Pharmacy Rejected',
        text: `Order #${orderId} rejected by pharmacy ${pharmacyId}.`,
      });
      return { ok: true };
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'ACCEPTED', pharmacyId },
    });

    await this.notify.create(
      order.customerId,
      'ORDER_ACCEPTED_BY_PHARMACY',
      `Order #${orderId} accepted.`,
      { orderId },
      pharmacyId,
    );

    const riders = await this.prisma.user.findMany({
      where: { role: 'RIDER', status: 'AVAILABLE' },
      take: 10,
    });

    if (!riders.length) {
      await this.orderAssignQueue.add('check_assignment', { orderId }, { delay: 1000 * 60 * 3 });
      await this.notify.create(order.customerId, 'NO_RIDERS_AVAILABLE', `No riders available for order ${orderId}.`, { orderId });
      this.notify.sendAdminToast?.({
        type: 'err',
        title: 'No Riders Available',
        text: `Order #${orderId} waiting for assignment.`,
      });
      return { ok: true, assigned: false };
    }

    for (const r of riders) {
      await this.prisma.orderOffer.create({
        data: { orderId, riderId: r.id, offeredTo: 'RIDER' },
      });
      await this.notify.create(r.id, 'ORDER_ASSIGNMENT_OFFER', `New order #${orderId} available.`, { orderId });
      this.ws.notifyUser(r.id, 'order_offer', { orderId });
    }

    await this.orderAssignQueue.add('check_assignment', { orderId }, { delay: 1000 * 60 * 3 });
    this.notify.sendAdminToast?.({
      type: 'info',
      title: 'Order Accepted',
      text: `Order #${orderId} accepted and offered to riders.`,
    });
    return { ok: true, offeredTo: riders.map((r) => r.id) };
  }

  // ✅ Rider response
  async riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    if (action === 'ACCEPTED') {
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: { riderId, status: 'OUT_FOR_DELIVERY' },
      });

      await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });

      await this.prisma.orderOffer.updateMany({ where: { orderId }, data: { status: 'EXPIRED' } });
      await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'ACCEPTED' } });

      await this.notify.create(order.customerId, 'ORDER_OUT_FOR_DELIVERY', `Rider assigned for order #${orderId}.`, { orderId }, riderId);
      await this.notify.create(order.pharmacyId, 'ORDER_ASSIGNED_TO_RIDER', `Rider ${riderId} assigned for order #${orderId}.`, { orderId }, riderId);

      this.ws.notifyUser(order.customerId, 'order_out_for_delivery', { orderId, riderId });
      this.notify.sendAdminToast?.({
        type: 'ok',
        title: 'Rider Accepted',
        text: `Order #${orderId} → Rider ${riderId}`,
      });
      return updated;
    }

    await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'REJECTED' } });
    this.notify.sendAdminToast?.({
      type: 'err',
      title: 'Rider Rejected',
      text: `Order #${orderId} declined by Rider ${riderId}.`,
    });
    return { ok: true };
  }

  // ✅ Rider stage updates
  async updateStage(
    riderId: number,
    orderId: number,
    stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED',
    location?: { lat: number; lng: number },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.riderId !== riderId)
      throw new BadRequestException('Not assigned to this rider.');

    await this.prisma.order.update({ where: { id: orderId }, data: { status: stage } });

    if (stage === 'DELIVERED') {
      await this.prisma.user.update({ where: { id: riderId }, data: { status: 'AVAILABLE' } });
      await this.notify.create(order.customerId, 'ORDER_DELIVERED', `Order #${orderId} delivered.`, { orderId }, riderId);
      this.notify.sendAdminToast?.({
        type: 'ok',
        title: 'Delivered',
        text: `Order #${orderId} completed by Rider ${riderId}.`,
      });
    } else {
      await this.notify.create(order.customerId, 'ORDER_UPDATE', `Order #${orderId} ${stage}.`, { orderId, stage }, riderId);
      this.notify.sendAdminToast?.({
        type: 'info',
        title: 'Order Update',
        text: `Order #${orderId} ${stage}.`,
      });
    }

    if (location)
      await this.prisma.user.update({
        where: { id: riderId },
        data: { latitude: location.lat, longitude: location.lng },
      });

    this.ws.notifyUser(order.customerId, 'order_status_update', { orderId, stage, location });
    return { ok: true };
  }

  // ✅ Admin manual assign
  async adminAssign(orderId: number, adminId: number, riderId: number) {
    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { riderId, status: 'OUT_FOR_DELIVERY' } });
    await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });
    await this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned by admin.`, { orderId }, adminId);
    this.notify.sendAdminToast?.({
      type: 'ok',
      title: 'Manual Assign',
      text: `Admin manually assigned Rider ${riderId} for Order #${orderId}.`,
    });
    return updated;
  }

  // ✅ Orders by role/user
  async findByUser(userId: number, role: string) {
    if (role === 'ADMIN')
      return this.prisma.order.findMany({ include: { items: true } });
    if (role === 'PHARMACY')
      return this.prisma.order.findMany({ where: { pharmacyId: userId }, include: { items: true } });
    if (role === 'RIDER')
      return this.prisma.order.findMany({ where: { riderId: userId }, include: { items: true } });
    return this.prisma.order.findMany({ where: { customerId: userId }, include: { items: true } });
  }
}
