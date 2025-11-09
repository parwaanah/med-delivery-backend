// src/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
    private config: ConfigService,
    private surge: SurgeService,
    private geoSurge: GeoSurgeService,
    @Inject('ORDER_ASSIGN_QUEUE') private orderAssignQueue: Queue,
  ) {}

  // 🛒 Create new order — triggers surge + geosurge updates
  async createOrder(customerId: number, dto: CreateOrderDto) {
    if (!customerId || isNaN(Number(customerId)))
      throw new BadRequestException('Invalid or missing customer ID.');
    if (!dto.items?.length)
      throw new BadRequestException('No items provided.');

    const total = dto.items.reduce((s, it) => s + it.price * it.quantity, 0);

    // ✅ Surge
    try {
      await this.surge.incrementDemand(1);
    } catch (err) {
      this.logger.warn('⚠️ Surge demand update failed:', err);
    }

    // ✅ GeoSurge pickup coordinate (optional)
    try {
      if (dto.pickupLat && dto.pickupLon) {
        await this.geoSurge.addPoint(
          `order:${Date.now()}`,
          dto.pickupLon,
          dto.pickupLat,
        );
      }
    } catch (err) {
      this.logger.warn('⚠️ GeoSurge update failed:', err);
    }

    // --- Direct pharmacy order flow ---
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

    // --- Broadcast order by medicine stock ---
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
      _count: { medicineId: true },
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

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: stage },
    });

    if (stage === 'DELIVERED') {
      await this.prisma.user.update({
        where: { id: riderId },
        data: { status: 'AVAILABLE' },
      });
      await this.surge.recordRiderAvailability(riderId, true);

      try {
        await this.geoSurge.removePoint(`order:${orderId}`);
      } catch {}

      await this.notify.create(
        order.customerId,
        'ORDER_DELIVERED',
        `Order #${orderId} delivered.`,
        { orderId },
        riderId,
      );
      this.notify.sendAdminToast?.({
        type: 'ok',
        title: 'Delivered',
        text: `Order #${orderId} completed by Rider ${riderId}.`,
      });
    }

    if (location)
      await this.prisma.user.update({
        where: { id: riderId },
        data: { latitude: location.lat, longitude: location.lng },
      });

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      stage,
      location,
    });
    return { ok: true };
  }

  // ✅ Admin manual assign
  async adminAssign(orderId: number, adminId: number, riderId: number) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { riderId, status: 'OUT_FOR_DELIVERY' },
    });
    await this.prisma.user.update({
      where: { id: riderId },
      data: { status: 'BUSY' },
    });
    await this.notify.create(
      updated.customerId,
      'ORDER_ASSIGNED_BY_ADMIN',
      `Order #${orderId} assigned by admin.`,
      { orderId },
      adminId,
    );
    this.notify.sendAdminToast?.({
      type: 'ok',
      title: 'Manual Assign',
      text: `Admin manually assigned Rider ${riderId} for Order #${orderId}.`,
    });
    return updated;
  }

  // ✅ Pharmacy response
  async pharmacyRespond(
    pharmacyId: number,
    orderId: number,
    action: 'ACCEPTED' | 'REJECTED',
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    if (action === 'REJECTED') {
      await this.prisma.orderOffer.updateMany({
        where: { orderId, pharmacyId },
        data: { status: 'REJECTED' },
      });
      return { ok: true };
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { pharmacyId, status: 'ACCEPTED' },
    });
  }

  // ✅ Rider response
  async riderRespond(
    riderId: number,
    orderId: number,
    action: 'ACCEPTED' | 'REJECTED',
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    if (action === 'ACCEPTED') {
      await this.surge.recordRiderAvailability(riderId, false);
      return this.prisma.order.update({
        where: { id: orderId },
        data: { riderId, status: 'OUT_FOR_DELIVERY' },
      });
    }

    await this.prisma.orderOffer.updateMany({
      where: { orderId, riderId },
      data: { status: 'REJECTED' },
    });
    return { ok: true };
  }

  // ✅ Fetch orders by role
  async findByUser(userId: number, role: string) {
    if (role === 'ADMIN')
      return this.prisma.order.findMany({ include: { items: true } });
    if (role === 'PHARMACY')
      return this.prisma.order.findMany({
        where: { pharmacyId: userId },
        include: { items: true },
      });
    if (role === 'RIDER')
      return this.prisma.order.findMany({
        where: { riderId: userId },
        include: { items: true },
      });
    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: { items: true },
    });
  }
}
