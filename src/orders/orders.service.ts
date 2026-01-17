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
import { OrderItemDto } from './dto/order-item.dto';

import { Queue } from 'bullmq';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeService } from '../surge/surge.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { PaymentsService } from '../payments/payments.service';

import { OrderStatus, PaymentMode, UserRole } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly defaultRiderSearchKm: number;
  private readonly riderSpeedKmPerHr = 30;
  private readonly isLoadtest: boolean;

  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
    private config: ConfigService,
    private surge: SurgeService,
    private geoSurge: GeoSurgeService,
    private payments: PaymentsService,
    @Inject('ORDER_ASSIGN_QUEUE') private orderAssignQueue: Queue,
  ) {
    this.defaultRiderSearchKm = Number(this.config.get('RIDER_SEARCH_KM') || 5);
    this.isLoadtest =
      String(
        process.env.LOADTEST_MODE || this.config.get('LOADTEST_MODE') || '',
      )
        .trim()
        .toLowerCase() === 'true';

    if (this.isLoadtest)
      this.logger.warn(
        'LOADTEST_MODE ACTIVE → inventory bypass + payment bypass enabled.',
      );
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private isEscalatable(status: OrderStatus) {
    return (
      status === OrderStatus.PENDING ||
      status === OrderStatus.ACCEPTED ||
      status === OrderStatus.ASSIGNED
    );
  }

  private toRad(v: number) {
    return (v * Math.PI) / 180;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async logTimeline(orderId: number, event: string, data?: any) {
    try {
      await this.prisma.orderTimeline.create({
        data: {
          orderId,
          event,
          data: data ? JSON.stringify(data) : undefined,
        },
      });
    } catch (e) {
      this.logger.warn('Timeline failed', (e as any)?.message ?? e);
    }
  }

  // ----------------------------------------------------------
  // Payment mode resolver
  // ----------------------------------------------------------
  private resolveModeFromItems(items: OrderItemDto[]) {
    let requiresPrescription = false;
    let hasStrict = false;
    let hasChronic = false;
    let hasNonRx = false;

    for (const it of items) {
      const cat = (it as any).category;
      if (!cat) {
        hasChronic = true;
        continue;
      }

      const c = String(cat).toUpperCase();
      if (c === 'STRICT_RX' || c === 'STRICT' || c === 'HARD') {
        hasStrict = true;
        requiresPrescription = true;
      } else if (c === 'CHRONIC' || c === 'SOFT') {
        hasChronic = true;
      } else {
        hasNonRx = true;
      }
    }

    if (hasStrict)
      return {
        mode: PaymentMode.PAY_AFTER_VERIFICATION,
        requiresPrescription: true,
      };
    if (hasChronic && !hasNonRx)
      return { mode: PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
    if (hasNonRx && !hasChronic)
      return { mode: PaymentMode.PAY_FIRST, requiresPrescription: false };

    return { mode: PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
  }

  // ----------------------------------------------------------
  // LOADTEST: stable pharmacy fetcher (never returns null)
  // ----------------------------------------------------------
  private async getAnyPharmacyId() {
    const p = await this.prisma.user.findFirst({
      where: { role: UserRole.PHARMACY },
      select: { id: true },
    });

    // fallback: always return 1 to avoid FK crash
    return p?.id ?? 1;
  }
    // ----------------------------------------------------------
  // CREATE ORDER — FULL METHOD
  // ----------------------------------------------------------
  async createOrder(customerId: number, dto: CreateOrderDto) {
    if (!customerId)
  throw new BadRequestException('Invalid customer');
    if (!dto.items?.length)
      throw new BadRequestException('No items provided');

    const medicineIds = dto.items
      .map((i) => i.medicineId)
      .filter((v) => typeof v === 'number') as number[];

    if (!medicineIds.length)
      throw new BadRequestException('Invalid items');

    const { mode, requiresPrescription } = this.resolveModeFromItems(
      dto.items,
    );

    // Geo tracking (best-effort)
    const orderGeoId = `order:${Date.now()}:${Math.random()
      .toString()
      .slice(2)}`;
    const user = await this.prisma.user.findUnique({
      where: { id: customerId },
    });
    const pickupLat = user?.latitude != null ? Number(user.latitude) : null;
    const pickupLon = user?.longitude != null ? Number(user.longitude) : null;

    if (pickupLat != null && pickupLon != null) {
      try {
        await this.geoSurge.addPoint(orderGeoId, pickupLon, pickupLat);
      } catch {}
    }

    // ----------------------------------------------------------
    // CASE 1: Direct pharmacy selected
    // ----------------------------------------------------------
    if ((dto as any).pharmacyId) {
      // LOADTEST MODE bypass inventory completely
      if (this.isLoadtest) {
        const chosen =
          Number((dto as any).pharmacyId) || (await this.getAnyPharmacyId());

        // FINAL safety: ensure pharmacyId always exists
        const validPharmacy = await this.prisma.user.findUnique({
          where: { id: chosen },
          select: { id: true },
        });
        const pharmacyId = validPharmacy?.id ?? (await this.getAnyPharmacyId());

        let total = 0;
        const itemsCreate = dto.items.map((it) => {
          const price = (it as any).price ? Number((it as any).price) : 10;
          total += price * (it.quantity ?? 1);

          return {
            medicineId: it.medicineId ?? 0,
            name:
              it.name ??
              `LT_Item_${it.medicineId ?? Math.random().toString(36)}`,
            quantity: it.quantity ?? 1,
            price,
          };
        });

        const created = await this.prisma.order.create({
          data: {
            customerId,
            pharmacyId,
            totalPrice: total,
            status: OrderStatus.PENDING,
            paymentMode: mode,
            requiresPrescription,
            items: { create: itemsCreate },
          },
          include: { items: true },
        });

        await this.prisma.orderOffer.create({
          data: {
            orderId: created.id,
            pharmacyId,
            offeredTo: 'PHARMACY',
          },
        });

        await this.logTimeline(created.id, 'ORDER_CREATED', {
          loadtest: true,
          mode,
          requiresPrescription,
        });

        this.notify.create(
          pharmacyId,
          'ORDER_PLACED',
          `Order #${created.id}`,
          { orderId: created.id },
          customerId,
        );
        this.ws.notifyUser(pharmacyId, 'order_placed', created);

        // PAY_FIRST bypass
        if (mode === PaymentMode.PAY_FIRST) {
          try {
            await this.geoSurge.removePoint(orderGeoId);
          } catch {}
          return {
            order: created,
            payment: {
              mock: true,
              status: 'PAID',
              id: `mock_${created.id}`,
            },
          };
        }

        const delay =
          Number(this.config.get('ESCALATION_MINUTES') || 1) *
          60 *
          1000;

        await this.orderAssignQueue.add(
          'rider_escalation',
          { orderId: created.id },
          { delay },
        );

        try {
          await this.geoSurge.removePoint(orderGeoId);
        } catch {}

        return created;
      }

      // NORMAL MODE: validate inventory
      const pharmacyId = Number((dto as any).pharmacyId);

      const inv = await this.prisma.pharmacyInventory.findMany({
        where: {
          pharmacyId,
          medicineId: { in: medicineIds },
        },
      });

      if (inv.length !== medicineIds.length)
        throw new NotFoundException('Some items not available at pharmacy');

      const order = await this.prisma.$transaction(async (tx) => {
        let total = 0;
        const itemsCreate = [];

        for (const it of dto.items) {
          const row = inv.find((r) => r.medicineId === it.medicineId);
          if (!row)
            throw new BadRequestException('Item not stocked');
          if (row.stock < it.quantity)
            throw new BadRequestException(
              `Insufficient stock for ${it.medicineId}`,
            );

          const price = Number(row.sellingPrice);
          total += price * it.quantity;

          const med = await tx.medicine.findUnique({
            where: { id: it.medicineId },
          });
          itemsCreate.push({
            medicineId: it.medicineId,
            name: med?.name ?? it.name ?? 'Item',
            quantity: it.quantity,
            price,
          });
        }

        const created = await tx.order.create({
          data: {
            customerId,
            pharmacyId,
            totalPrice: total,
            status: OrderStatus.PENDING,
            paymentMode: mode,
            requiresPrescription,
            items: { create: itemsCreate },
          },
          include: { items: true },
        });

        for (const it of dto.items) {
          await tx.pharmacyInventory.updateMany({
            where: {
              pharmacyId,
              medicineId: it.medicineId,
            },
            data: { stock: { decrement: it.quantity } },
          });
        }

        await tx.orderOffer.create({
          data: {
            orderId: created.id,
            pharmacyId,
            offeredTo: 'PHARMACY',
          },
        });

        return created;
      });

      await this.logTimeline(order.id, 'ORDER_CREATED', {
        mode,
        requiresPrescription,
      });

      this.notify.create(
        order.pharmacyId,
        'ORDER_PLACED',
        `Order #${order.id}`,
        { orderId: order.id },
        customerId,
      );
      this.ws.notifyUser(order.pharmacyId, 'order_placed', order);

      if (mode === PaymentMode.PAY_FIRST) {
        const payment = await this.payments.createPaymentForOrder(order.id);
        try {
          await this.geoSurge.removePoint(orderGeoId);
        } catch {}
        return { order, payment };
      }

      const delay =
        Number(this.config.get('ESCALATION_MINUTES') || 1) *
        60 *
        1000;

      await this.orderAssignQueue.add(
        'rider_escalation',
        { orderId: order.id },
        { delay },
      );

      try {
        await this.geoSurge.removePoint(orderGeoId);
      } catch {}

      return order;
    }
        // ----------------------------------------------------------
    // CASE 2: AUTO-ROUTING
    // ----------------------------------------------------------

    // LOADTEST → bypass inventory routing
    if (this.isLoadtest) {
      const best =
        (await this.getAnyPharmacyId()) ??
        Number(this.config.get('LOADTEST_PHARMACY_ID'));

      if (!best) throw new NotFoundException('No pharmacy available');

      let total = 0;
      const itemsCreate = dto.items.map((it) => {
        const price = (it as any).price ? Number((it as any).price) : 10;
        total += price * (it.quantity ?? 1);

        return {
          medicineId: it.medicineId ?? 0,
          name:
            it.name ??
            `LT_Item_${it.medicineId ?? Math.random().toString(36)}`,
          quantity: it.quantity ?? 1,
          price,
        };
      });

      const created = await this.prisma.$transaction(async (tx) => {
        const ord = await tx.order.create({
          data: {
            customerId,
            pharmacyId: best,
            totalPrice: total,
            status: OrderStatus.PENDING,
            paymentMode: mode,
            requiresPrescription,
            items: { create: itemsCreate },
          },
          include: { items: true },
        });

        await tx.orderOffer.create({
          data: {
            orderId: ord.id,
            pharmacyId: best,
            offeredTo: 'PHARMACY',
          },
        });

        return ord;
      });

      await this.logTimeline(created.id, 'ORDER_CREATED', {
        loadtest: true,
        bestPharmacyId: best,
        mode,
        requiresPrescription,
      });

      this.notify.create(
        best,
        'ORDER_AVAILABLE',
        `Order #${created.id}`,
        { orderId: created.id },
        customerId,
      );
      this.ws.notifyUser(best, 'order_available', { orderId: created.id });

      // Bypass Pay-first
      if (mode === PaymentMode.PAY_FIRST) {
        try {
          await this.geoSurge.removePoint(orderGeoId);
        } catch {}
        return {
          order: created,
          candidates: [best],
          scores: [{ pharmacyId: best, score: 1 }],
          payment: {
            mock: true,
            status: 'PAID',
            id: `mock_${created.id}`,
          },
        };
      }

      const delay =
        Number(this.config.get('ESCALATION_MINUTES') || 1) *
        60 *
        1000;
      await this.orderAssignQueue.add('rider_escalation', { orderId: created.id }, { delay });

      try { await this.geoSurge.removePoint(orderGeoId); } catch {}

      return { order: created, candidates: [best], scores: [{ pharmacyId: best, score: 1 }] };
    }

    // NORMAL MODE auto-routing
    const grouped = await this.prisma.pharmacyInventory.groupBy({
      by: ['pharmacyId'],
      where: {
        medicineId: { in: medicineIds },
        stock: { gt: 0 },
      },
      _count: { medicineId: true },
    });

    const pharmacyIds = grouped
      .filter((g) => g._count.medicineId === medicineIds.length)
      .map((g) => g.pharmacyId);

    if (!pharmacyIds.length) throw new NotFoundException('No pharmacy has all items in stock');

    const scores = pharmacyIds.map((pid) => ({ pharmacyId: pid, score: 1 }));

    const bestPharmacyId = scores[0].pharmacyId;

    const inv2 = await this.prisma.pharmacyInventory.findMany({
      where: { pharmacyId: bestPharmacyId, medicineId: { in: medicineIds } },
    });

    const finalOrder = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const itemsCreate: any[] = [];

      for (const it of dto.items) {
        const row = inv2.find((r) => r.medicineId === it.medicineId);
        if (!row) throw new BadRequestException('Item not in stock');
        if (row.stock < it.quantity) throw new BadRequestException(`Low stock for ${it.medicineId}`);

        const price = Number(row.sellingPrice);
        total += price * it.quantity;

        const med = await tx.medicine.findUnique({ where: { id: it.medicineId } });
        itemsCreate.push({ medicineId: it.medicineId, name: med?.name ?? it.name ?? 'Item', quantity: it.quantity, price });
      }

      const created = await tx.order.create({
        data: {
          customerId,
          pharmacyId: bestPharmacyId,
          totalPrice: total,
          status: OrderStatus.PENDING,
          paymentMode: mode,
          requiresPrescription,
          items: { create: itemsCreate },
        },
        include: { items: true },
      });

      for (const it of dto.items) {
        await tx.pharmacyInventory.updateMany({
          where: { pharmacyId: bestPharmacyId, medicineId: it.medicineId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      for (const pid of pharmacyIds) {
        await tx.orderOffer.create({
          data: { orderId: created.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
        });
      }

      return created;
    });

    await this.logTimeline(finalOrder.id, 'ORDER_CREATED', {
      candidates: pharmacyIds,
      bestPharmacyId,
      mode,
      requiresPrescription,
    });

    for (const pid of pharmacyIds) {
      this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${finalOrder.id}`, { orderId: finalOrder.id }, customerId);
      this.ws.notifyUser(pid, 'order_available', { orderId: finalOrder.id });
    }

    // PAY_FIRST: real mode
    if (mode === PaymentMode.PAY_FIRST) {
      const payment = await this.payments.createPaymentForOrder(finalOrder.id);
      try { await this.geoSurge.removePoint(orderGeoId); } catch {}
      return { order: finalOrder, candidates: pharmacyIds, scores, payment };
    }

    const delay2 = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
    await this.orderAssignQueue.add('rider_escalation', { orderId: finalOrder.id }, { delay: delay2 });
    try { await this.geoSurge.removePoint(orderGeoId); } catch {}

    return { order: finalOrder, candidates: pharmacyIds, scores };
  }

  // ----------------------------------------------------------
  // Upload prescription
  // ----------------------------------------------------------
  async uploadPrescription(customerId: number, url: string, attachOrderId?: number) {
    if (!url) throw new BadRequestException('Invalid URL');

    const pres = await this.prisma.prescription.create({ data: { customerId, url } });

    await this.logTimeline(attachOrderId ?? 0, 'PRESCRIPTION_UPLOADED', { url, prescriptionId: pres.id });

    if (attachOrderId) {
      try {
        await this.prisma.order.update({ where: { id: attachOrderId }, data: { prescriptionId: pres.id } });

        const order = await this.prisma.order.findUnique({ where: { id: attachOrderId } });
        if (order && order.pharmacyId) {
          this.notify.create(order.pharmacyId, 'PRESCRIPTION_UPLOADED', 'Prescription added', { orderId: order.id, prescriptionId: pres.id }, customerId);
          this.ws.notifyUser(order.pharmacyId, 'prescription_uploaded', { orderId: order.id, prescriptionId: pres.id });
        }
      } catch (e) {
        this.logger.warn('Failed attaching prescription to order', (e as any)?.message ?? e);
      }
    }

    return pres;
  }

  // ----------------------------------------------------------
  // Pharmacy REQUEST PRESCRIPTION
  // ----------------------------------------------------------
  async pharmacyRequestPrescription(pharmacyId: number, orderId: number, message?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.pharmacyId !== pharmacyId) throw new BadRequestException('Not authorized for this order');

    await this.prisma.order.update({ where: { id: orderId }, data: { requiresPrescription: true } });

    await this.logTimeline(orderId, 'PRESCRIPTION_REQUESTED_BY_PHARMACY', { pharmacyId, message });

    this.notify.create(order.customerId, 'PRESCRIPTION_REQUIRED', message || 'Pharmacy requested a prescription for your order', { orderId }, pharmacyId);
    this.ws.notifyUser(order.customerId, 'prescription_required', { orderId, message });

    return { ok: true };
  }

  // ----------------------------------------------------------
  // Pharmacy respond
  // ----------------------------------------------------------
  async pharmacyRespond(pharmacyId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, prescription: true } });
    if (!order) throw new NotFoundException('Order not found');

    if (action === 'REJECTED') {
      await this.prisma.orderOffer.updateMany({ where: { orderId, pharmacyId }, data: { status: 'REJECTED' } });
      await this.logTimeline(orderId, 'PHARMACY_REJECTED', { pharmacyId });
      return { ok: true };
    }

    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.ACCEPTED, pharmacyId }, include: { items: true } });

    await this.prisma.orderOffer.updateMany({ where: { orderId, pharmacyId: { not: pharmacyId } }, data: { status: 'REJECTED' } });

    await this.logTimeline(orderId, 'PHARMACY_ACCEPTED', { pharmacyId });

    // LOADTEST payment bypass
    if (updated.paymentMode === PaymentMode.PAY_AFTER_ACCEPT || updated.paymentMode === PaymentMode.PAY_AFTER_VERIFICATION) {
      if (this.isLoadtest) {
        this.ws.notifyUser(updated.customerId, 'payment_required', { orderId, payment: { mock: true, status: 'PAID', id: `mock_${orderId}` } });
        return { order: updated, payment: { mock: true, status: 'PAID' } };
      }

      const payment = await this.payments.createPaymentForOrder(orderId);
      this.ws.notifyUser(updated.customerId, 'payment_required', { orderId, payment });
      return { order: updated, payment };
    }

    const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60000;
    await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });

    return { order: updated };
  }

  // ----------------------------------------------------------
  // Rider respond
  // ----------------------------------------------------------
  async riderRespond(riderId: number, orderId: number, action: 'ACCEPTED' | 'REJECTED') {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (action === 'ACCEPTED') {
      await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });
      const updated = await this.prisma.order.update({ where: { id: orderId }, data: { riderId, status: OrderStatus.OUT_FOR_DELIVERY } });
      await this.logTimeline(orderId, 'RIDER_ACCEPTED', { riderId });
      return updated;
    }

    await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'REJECTED' } });
    await this.logTimeline(orderId, 'RIDER_REJECTED', { riderId });
    
    // Re-queue escalation on rider rejection
    const delay =
      Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
    await this.orderAssignQueue.add(
      'rider_escalation',
      { orderId },
      { delay },
    );
    
    return { ok: true };
  }
  
  // ----------------------------------------------------------
  // Admin assign
  // ----------------------------------------------------------
  async adminAssign(orderId: number, adminId: number, riderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (!this.isEscalatable(order.status)) {
      throw new BadRequestException(
        `Order cannot be assigned in status ${order.status}`,
      );
    }

    const rider = await this.prisma.user.findUnique({
      where: { id: riderId },
    });
    if (!rider || rider.role !== UserRole.RIDER) {
      throw new BadRequestException('Invalid rider');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: riderId },
        data: { status: 'BUSY' },
      });

      return tx.order.update({
        where: { id: orderId },
        data: {
          riderId,
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
      });
    });

    await this.logTimeline(orderId, 'ASSIGNED_BY_ADMIN', {
      adminId,
      riderId,
    });

    this.notify.create(
      updated.customerId,
      'ORDER_ASSIGNED_BY_ADMIN',
      `Order #${orderId} assigned`,
      { orderId },
      adminId,
    );

    this.ws.notifyUser(updated.customerId, 'order_status_update', {
      orderId,
      stage: OrderStatus.OUT_FOR_DELIVERY,
    });

    return updated;
  }

  // ----------------------------------------------------------
  // Rider stage update
  // ----------------------------------------------------------
  async updateStage(
    riderId: number,
    orderId: number,
    stage: OrderStatus,
    location?: { lat?: number; lng?: number },
  ) {
    if (!Object.values(OrderStatus).includes(stage)) {
      throw new BadRequestException('Invalid order stage');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.riderId !== riderId)
      throw new BadRequestException('Not your order');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: stage },
    });

    if (stage === OrderStatus.DELIVERED) {
      await this.prisma.user.update({
        where: { id: riderId },
        data: { status: 'AVAILABLE' },
      });

      await this.logTimeline(orderId, 'DELIVERED', {
        riderId,
      });

      try {
        await this.geoSurge.removePoint(`order:${orderId}`);
      } catch {}

      this.notify.create(
        order.customerId,
        'ORDER_DELIVERED',
        `Order #${orderId} delivered.`,
        { orderId },
        riderId,
      );
    }

    if (location?.lat != null && location?.lng != null) {
      await this.prisma.user.update({
        where: { id: riderId },
        data: {
          latitude: location.lat,
          longitude: location.lng,
        },
      });
    }

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      stage,
      location,
    });

    return { ok: true };
  }

  // ----------------------------------------------------------
  // Find orders by user
  // ----------------------------------------------------------
  async findByUser(userId: number, role: string) {
    if (role === UserRole.ADMIN)
      return this.prisma.order.findMany({
        include: { items: true, prescription: true },
      });

    if (role === UserRole.PHARMACY)
      return this.prisma.order.findMany({
        where: { pharmacyId: userId },
        include: { items: true, prescription: true },
      });

    if (role === UserRole.RIDER)
      return this.prisma.order.findMany({
        where: { riderId: userId },
        include: { items: true, prescription: true },
      });

    return this.prisma.order.findMany({
      where: { customerId: userId },
      include: { items: true, prescription: true },
    });
  }

  // ----------------------------------------------------------
  // Timeline
  // ----------------------------------------------------------
  async getTimeline(orderId: number) {
    const events = await this.prisma.orderTimeline.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((e) => ({
      event: e.event,
      data: e.data ? JSON.parse(e.data) : {},
      at: e.createdAt,
    }));
  }

  // ----------------------------------------------------------
  // Simple rider score
  // ----------------------------------------------------------
  async getRiderScorePublic(
    rp: { memberId: string; distKm?: number; meta?: any },
    lat?: number | null,
    lon?: number | null,
  ) {
    let base = 50;

    if (typeof rp.distKm === 'number') {
      base = Math.max(
        1,
        Math.round(Math.max(0, 100 - rp.distKm * 10)),
      );
    } else if (lat != null && lon != null && rp.meta?.lat && rp.meta?.lon) {
      try {
        const km = this.haversineKm(
          Number(rp.meta.lat),
          Number(rp.meta.lon),
          lat,
          lon,
        );
        base = Math.max(
          1,
          Math.round(Math.max(0, 100 - km * 10)),
        );
      } catch {
        base = 10;
      }
    } else {
      base = 10;
    }

    try {
      const match = (rp.memberId || '').match(/^rider:(\d+)$/);
      const riderId = match ? Number(match[1]) : NaN;

      if (!isNaN(riderId)) {
        const r = await this.prisma.user.findUnique({
          where: { id: riderId },
          select: { status: true },
        });
        if (r?.status === 'AVAILABLE') base += 20;
      }
    } catch {}

    return Math.min(100, base);
  }
  
  // ----------------------------------------------------------
  // ADMIN OVERRIDES (E4.3)
  // ----------------------------------------------------------

  async adminForceCancel(orderId: number, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELED, riderId: null },
    });

    await this.logTimeline(orderId, 'ADMIN_FORCE_CANCEL', { reason });

    this.ws.notifyUser(order.customerId, 'order_canceled', {
      orderId,
      reason,
    });

    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order_canceled', {
        orderId,
        reason,
      });
    }

    if (typeof (this.ws as any).notifyAdmins === 'function') {
      (this.ws as any).notifyAdmins('admin_order_override', {
        orderId,
        action: 'CANCEL',
      });
    }
    
    return updated;
  }

  async adminForceStatus(
    orderId: number,
    status: OrderStatus,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    await this.logTimeline(orderId, 'ADMIN_FORCE_STATUS', {
      to: status,
      note,
    });

    this.ws.notifyUser(order.customerId, 'order_status_update', {
      orderId,
      status,
    });

    if (order.pharmacyId) {
      this.ws.notifyUser(order.pharmacyId, 'order_status_update', {
        orderId,
        status,
      });
    }

    return updated;
  }

  async adminUnassignRider(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (!order.riderId) return order;

    await this.prisma.user.update({
      where: { id: order.riderId },
      data: { status: 'AVAILABLE' },
    });

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { riderId: null, status: OrderStatus.ASSIGNED },
    });

    await this.logTimeline(orderId, 'ADMIN_UNASSIGNED_RIDER');

    return updated;
  }

  async adminAddNote(orderId: number, note: string) {
    await this.logTimeline(orderId, 'ADMIN_NOTE', { note });
    return { ok: true };
  }
}