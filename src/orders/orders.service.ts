// src/orders/orders.service.ts
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
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

  // Create order either for a specific pharmacy or broadcast by medicine
  async createOrder(customerId: number, dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) throw new BadRequestException('No items provided');

    const total = dto.items.reduce((s, it) => s + (it.price * it.quantity), 0);

    // If pharmacyId specified: create and notify that pharmacy
    if (dto.pharmacyId) {
      const p = await this.prisma.user.findUnique({ where: { id: dto.pharmacyId }});
      if (!p || p.role !== 'PHARMACY') throw new NotFoundException('Pharmacy not found');

      const order = await this.prisma.order.create({
        data: {
          customerId,
          pharmacyId: dto.pharmacyId,
          totalPrice: total,
          status: 'PENDING',
          items: { create: dto.items.map(it => ({ medicineId: it.medicineId ?? undefined, name: it.name, quantity: it.quantity, price: it.price })) }
        },
        include: { items: true }
      });

      await this.notify.create(dto.pharmacyId, 'ORDER_PLACED', `New order #${order.id}`, { orderId: order.id }, customerId);
      this.ws.notifyUser(dto.pharmacyId, 'order_placed', order);

      return order;
    }

    // Medicine search mode: find candidate pharmacies
    const medicineIds = dto.items.map(i => i.medicineId).filter(Boolean) as number[];
    if (medicineIds.length === 0) throw new BadRequestException('No searchable medicines provided');

    // Find pharmacies having all medicines in stock (>0)
    const candidates = await this.prisma.pharmacyInventory.groupBy({
      by: ['pharmacyId'],
      where: { medicineId: { in: medicineIds }, stock: { gt: 0 } },
      _count: { medicineId: true },
    });

    const pharmacyIds = candidates.filter(c => c._count.medicineId === medicineIds.length).map(c => c.pharmacyId);
    if (pharmacyIds.length === 0) throw new NotFoundException('No pharmacies with full stock found nearby');

    // Create order with pharmacyId = first candidate (placeholder)
    const order = await this.prisma.order.create({
      data: {
        customerId,
        pharmacyId: pharmacyIds[0],
        totalPrice: total,
        status: 'PENDING',
        items: { create: dto.items.map(it => ({ medicineId: it.medicineId ?? undefined, name: it.name, quantity: it.quantity, price: it.price })) }
      },
    });

    // create OrderOffer entries and notify all candidate pharmacies
    for (const pid of pharmacyIds) {
      await this.prisma.orderOffer.create({
        data: { orderId: order.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
      });
      await this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${order.id} available to accept`, { orderId: order.id }, customerId);
      this.ws.notifyUser(pid, 'order_available', { orderId: order.id });
    }

    return { order, candidates: pharmacyIds };
  }

  async pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }});
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') throw new BadRequestException('Order not pending');

    // mark offer record
    await this.prisma.orderOffer.updateMany({
      where: { orderId, pharmacyId },
      data: { status: action }
    });

    if (action === 'REJECTED') {
      // notify the customer and continue waiting for others
      await this.notify.create(order.customerId, 'ORDER_REJECTED_BY_PHARMACY', `Order #${orderId} rejected by pharmacy ${pharmacyId}`, { orderId }, pharmacyId);
      return { ok: true };
    }

    // ACCEPTED:
    await this.prisma.order.update({ where: { id: orderId }, data: { status: 'ACCEPTED', pharmacyId }});
    await this.notify.create(order.customerId, 'ORDER_ACCEPTED_BY_PHARMACY', `Order #${orderId} accepted`, { orderId }, pharmacyId);

    // find available riders to offer to
    const riders = await this.prisma.user.findMany({ where: { role: 'RIDER', status: 'AVAILABLE' }, take: 10 });
    if (!riders.length) {
      // enqueue immediate escalation job
      await this.orderAssignQueue.add('check_assignment', { orderId }, { delay: 1000 * 60 * 3 });
      await this.notify.create(order.customerId, 'NO_RIDERS_AVAILABLE', `No riders available for order ${orderId}`, { orderId });
      return { ok: true, assigned: false };
    }

    // create offers for riders and notify them
    for (const r of riders) {
      await this.prisma.orderOffer.create({ data: { orderId, riderId: r.id, offeredTo: 'RIDER' }});
      await this.notify.create(r.id, 'ORDER_ASSIGNMENT_OFFER', `New order #${orderId} available`, { orderId });
      this.ws.notifyUser(r.id, 'order_offer', { orderId });
    }

    // schedule an assignment check after 3 minutes
    await this.orderAssignQueue.add('check_assignment', { orderId }, { delay: 1000 * 60 * 3 });

    return { ok: true, offeredTo: riders.map(r=>r.id) };
  }

  async riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }});
    if (!order) throw new NotFoundException('Order not found');

    // if accepted: assign and update statuses
    if (action === 'ACCEPTED') {
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: { riderId, status: 'OUT_FOR_DELIVERY' }
      });

      // set rider busy
      await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' }});

      // mark offers
      await this.prisma.orderOffer.updateMany({ where: { orderId }, data: { status: 'EXPIRED' }});
      await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'ACCEPTED' }});

      // cancel scheduled job is handled by worker when it checks that order.riderId exists
      await this.notify.create(order.customerId, 'ORDER_OUT_FOR_DELIVERY', `Rider assigned for order #${orderId}`, { orderId }, riderId);
      await this.notify.create(order.pharmacyId, 'ORDER_ASSIGNED_TO_RIDER', `Rider ${riderId} assigned for order #${orderId}`, { orderId }, riderId);

      this.ws.notifyUser(order.customerId, 'order_out_for_delivery', { orderId, riderId });
      return updated;
    } else {
      // REJECT: mark offer rejected for this rider
      await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'REJECTED' }});
      return { ok: true };
    }
  }

  async updateStage(riderId: number, orderId: number, stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED', location?: { lat:number, lng:number }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }});
    if (!order) throw new NotFoundException('Order not found');
    if (order.riderId !== riderId) throw new BadRequestException('Not assigned to this rider');

    await this.prisma.order.update({ where: { id: orderId }, data: { status: stage }});

    if (stage === 'DELIVERED') {
      // free rider
      await this.prisma.user.update({ where: { id: riderId }, data: { status: 'AVAILABLE' }});
      await this.notify.create(order.customerId, 'ORDER_DELIVERED', `Order #${orderId} delivered`, { orderId }, riderId);
    } else {
      await this.notify.create(order.customerId, 'ORDER_UPDATE', `Order #${orderId} status: ${stage}`, { orderId, stage }, riderId);
    }

    if (location) {
      await this.prisma.user.update({ where: { id: riderId }, data: { latitude: location.lat, longitude: location.lng }});
    }

    this.ws.notifyUser(order.customerId, 'order_status_update', { orderId, stage, location });
    return { ok: true };
  }

  // admin manual assign
  async adminAssign(orderId: number, adminId: number, riderId: number) {
    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { riderId, status: 'OUT_FOR_DELIVERY' }});
    await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' }});
    await this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned by admin`, { orderId }, adminId);
    return updated;
  }

  // fetch orders for role-based listing
  async findByUser(userId: number, role: string) {
    if (role === 'ADMIN') return this.prisma.order.findMany({ include: { items: true }});
    if (role === 'PHARMACY') return this.prisma.order.findMany({ where: { pharmacyId: userId }, include: { items: true }});
    if (role === 'RIDER') return this.prisma.order.findMany({ where: { riderId: userId }, include: { items: true }});
    return this.prisma.order.findMany({ where: { customerId: userId }, include: { items: true }});
  }
}
