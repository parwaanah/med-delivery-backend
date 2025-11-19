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
import { GeoSurgeService, GeoPoint } from '../geosurge/geo-surge.service';
import { PaymentsService } from '../payments/payments.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly defaultRiderSearchKm = 5;
  private readonly riderSpeedKmPerHr = 30;

  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
    private config: ConfigService,
    private surge: SurgeService,
    private geoSurge: GeoSurgeService,
    private payments: PaymentsService, // ensure PaymentsService is provided in module
    @Inject('ORDER_ASSIGN_QUEUE') private orderAssignQueue: Queue,
  ) {}

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private estimateEtaMinutes(km: number) {
    if (!km || km <= 0) return 5;
    const hours = km / this.riderSpeedKmPerHr;
    return Math.max(2, Math.round(hours * 60));
  }

  private async computePharmacyScore(
    pharmacyId: number,
    pickupLat?: number,
    pickupLon?: number,
    medicineCount = 0,
  ) {
    const scoreParts: number[] = [];

    if (medicineCount > 0) {
      try {
        const stocked = await this.prisma.pharmacyInventory.count({
          where: { pharmacyId, stock: { gt: 0 } },
        });
        scoreParts.push(Math.min(40, (stocked / medicineCount) * 40));
      } catch {
        scoreParts.push(10);
      }
    } else scoreParts.push(10);

    try {
      const since = new Date(Date.now() - 30 * 60 * 1000);
      const accepted = await this.prisma.order.count({
        where: { pharmacyId, status: OrderStatus.ACCEPTED, updatedAt: { gte: since } },
      });
      scoreParts.push(Math.min(15, accepted * 3));
    } catch {
      scoreParts.push(5);
    }

    if (pickupLat && pickupLon) {
      try {
        const p = await this.prisma.user.findUnique({
          where: { id: pharmacyId },
          select: { latitude: true, longitude: true },
        });
        if (p?.latitude && p?.longitude) {
          const km = this.haversineKm(
            p.latitude,
            p.longitude,
            pickupLat,
            pickupLon,
          );
          scoreParts.push(Math.max(0, 20 - Math.min(20, km * 3)));
        } else scoreParts.push(5);
      } catch {
        scoreParts.push(5);
      }
    } else scoreParts.push(5);

    try {
      const { multiplier } = await this.surge.getStatus();
      scoreParts.push(Math.max(0, Math.min(10, (multiplier - 1) * 5)));
    } catch {
      scoreParts.push(0);
    }

    return Math.round(Math.min(100, scoreParts.reduce((a, b) => a + b, 0)));
  }

  private async computeRiderScore(
    riderPoint: GeoPoint,
    pickupLat?: number,
    pickupLon?: number,
  ) {
    const meta = riderPoint.meta || {};
    const match = riderPoint.memberId.match(/^rider:(\d+)$/);
    const riderId = match ? Number(match[1]) : NaN;

    let score = 0;

    try {
      if (!isNaN(riderId)) {
        const r = await this.prisma.user.findUnique({
          where: { id: riderId },
          select: { status: true },
        });
        score += r?.status === 'AVAILABLE' ? 40 : 10;
      } else score += 10;
    } catch {
      score += 5;
    }

    if (typeof riderPoint.distKm === 'number') {
      const d = riderPoint.distKm;
      score += Math.max(0, 30 - Math.min(30, d * 6));
    } else if (pickupLat && pickupLon && meta?.lat && meta?.lon) {
      const km = this.haversineKm(
        parseFloat(meta.lat),
        parseFloat(meta.lon),
        pickupLat,
        pickupLon,
      );
      score += Math.max(0, 30 - Math.min(30, km * 6));
    } else score += 5;

    try {
      if (!isNaN(riderId)) {
        const since = new Date(Date.now() - 30 * 60 * 1000);
        const assigned = await this.prisma.order.count({
          where: { riderId, createdAt: { gte: since } },
        });
        score += Math.max(0, 30 - Math.min(20, assigned * 6));
      } else score += 10;
    } catch {
      score += 10;
    }

    return Math.round(Math.min(100, score));
  }

  /**
   * createOrder:
   * - supports direct pharmacyId (customer chose a pharmacy)
   * - supports catalog mode (no pharmacy selected) -> smart routing creates offers
   * - does NOT charge payment here — payment created only after pharmacy ACCEPTS (Swiggy-style)
   */
  async createOrder(customerId: number, dto: CreateOrderDto) {
    if (!customerId || isNaN(+customerId))
      throw new BadRequestException('Invalid or missing customer ID.');
    if (!dto.items?.length) throw new BadRequestException('No items provided.');

    const total = dto.items.reduce((s, it) => s + it.price * it.quantity, 0);

    try {
      await this.surge.incrementDemand(1);
    } catch (err) {
      this.logger.warn('Surge increment failed', (err as any)?.message ?? err);
    }

    const orderGeoId = `order:${Date.now()}:${Math.random().toString().slice(2)}`;

    try {
      if (dto.pickupLat && dto.pickupLon) {
        await this.geoSurge.addPoint(orderGeoId, dto.pickupLon, dto.pickupLat);
      }
    } catch (err) {
      this.logger.warn('GeoSurge addPoint failed for order geo', (err as any)?.message ?? err);
    }

    // 1) DIRECT PHARMACY ORDER (customer selected pharmacy)
    if (dto.pharmacyId) {
      const pharmacy = await this.prisma.user.findUnique({
        where: { id: dto.pharmacyId },
      });
      if (!pharmacy || pharmacy.role !== 'PHARMACY')
        throw new NotFoundException('Pharmacy not found.');

      const order = await this.prisma.order.create({
        data: {
          customer: { connect: { id: +customerId } },
          pharmacy: { connect: { id: dto.pharmacyId } },
          totalPrice: total,
          status: OrderStatus.PENDING,
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

      // notify pharmacy to accept/reject
      await this.notify.create(
        dto.pharmacyId,
        'ORDER_PLACED',
        `New order #${order.id}`,
        { orderId: order.id },
        customerId,
      );
      this.ws.notifyUser(dto.pharmacyId, 'order_placed', order);

      // remove geo point and schedule escalation (rider assignment) later
      try { await this.geoSurge.removePoint(orderGeoId); } catch {}

      const delayMs = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
      await this.orderAssignQueue.add('rider_escalation', { orderId: order.id }, { delay: delayMs });

      return { order };
    }

    // 2) SMART AUTO-ROUTING (customer didn't pick pharmacy)
    const medicineIds = dto.items
      .map((i) => i.medicineId)
      .filter((id) => typeof id === 'number');

    if (!medicineIds.length)
      throw new BadRequestException('No valid medicine IDs.');

    const candidates = await this.prisma.pharmacyInventory.groupBy({
      by: ['pharmacyId'],
      where: { medicineId: { in: medicineIds }, stock: { gt: 0 } },
      _count: { medicineId: true },
    });

    const pharmacyIds = candidates
      .filter((c) => c._count.medicineId === medicineIds.length)
      .map((c) => c.pharmacyId);

    if (!pharmacyIds.length) throw new NotFoundException('No pharmacies with stock.');

    const scores = await Promise.all(
      pharmacyIds.map(async (pid) => ({
        pharmacyId: pid,
        score: await this.computePharmacyScore(pid, dto.pickupLat, dto.pickupLon, medicineIds.length),
      })),
    );

    scores.sort((a, b) => b.score - a.score || a.pharmacyId - b.pharmacyId);

    const bestPharmacyId = scores[0].pharmacyId;

    // create order assigned to bestPharmacy for data integrity but still PENDING (pharmacy must ACCEPT)
    const order = await this.prisma.order.create({
      data: {
        customer: { connect: { id: +customerId } },
        pharmacy: { connect: { id: bestPharmacyId } },
        totalPrice: total,
        status: OrderStatus.PENDING,
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

    // create offers and notify all candidate pharmacies
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

    // try pre-finding riders (best-effort) but do NOT assign unless workflow requires it later
    try {
      let searchLat = dto.pickupLat;
      let searchLon = dto.pickupLon;

      if ((!searchLat || !searchLon) && bestPharmacyId) {
        const p = await this.prisma.user.findUnique({
          where: { id: bestPharmacyId },
          select: { latitude: true, longitude: true },
        });
        if (p?.latitude && p?.longitude) {
          searchLat = p.latitude;
          searchLon = p.longitude;
        }
      }

      if (searchLat && searchLon) {
        const points = await this.geoSurge.findNearbyPoints(
          searchLon,
          searchLat,
          this.defaultRiderSearchKm,
          true,
          50,
        );

        const riderPoints = points.filter((pt) => /^rider:\d+$/.test(pt.memberId));

        const riderScores: { point: GeoPoint; score: number }[] = [];

        for (const rp of riderPoints) {
          const score = await this.computeRiderScore(rp, searchLat, searchLon);
          riderScores.push({ point: rp, score });
        }

        riderScores.sort((a, b) => b.score - a.score);
        // We intentionally do not auto-assign — just keep candidates info in DB if needed
      }
    } catch (err) {
      this.logger.warn('Auto-assign rider discovery failed:', (err as any)?.message ?? err);
    }

    try { await this.geoSurge.removePoint(orderGeoId); } catch {}

    // schedule escalation (admins notified if no rider assignment within delay)
    const delayMs = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
    await this.orderAssignQueue.add('rider_escalation', { orderId: order.id }, { delay: delayMs });

    return { order, candidates: pharmacyIds, scores };
  }

  /**
   * updateStage: used by rider to push status updates (REACHED_PHARMACY / PICKED_UP / DELIVERED)
   */
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
      data: { status: stage as any },
    });

    if (stage === 'DELIVERED') {
      await this.prisma.user.update({ where: { id: riderId }, data: { status: 'AVAILABLE' } });
      await this.surge.recordRiderAvailability(riderId, true);
      try { await this.geoSurge.removePoint(`order:${orderId}`); } catch {}

      await this.notify.create(
        order.customerId,
        'ORDER_DELIVERED',
        `Order #${orderId} delivered.`,
        { orderId },
        riderId,
      );
    }

    if (location) {
      await this.prisma.user.update({
        where: { id: riderId },
        data: { latitude: location.lat, longitude: location.lng },
      });
    }

    this.ws.notifyUser(order.customerId, 'order_status_update', { orderId, stage, location });
    return { ok: true };
  }

  /**
   * Admin manual assign (used by admin UI / escalation)
   */
  async adminAssign(orderId: number, adminId: number, riderId: number) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { riderId, status: OrderStatus.OUT_FOR_DELIVERY },
    });

    await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });

    await this.notify.create(
      updated.customerId,
      'ORDER_ASSIGNED_BY_ADMIN',
      `Order #${orderId} assigned by admin.`,
      { orderId },
      adminId,
    );

    return updated;
  }

  /**
   * pharmacyRespond:
   * - if REJECTED: mark that pharmacy's offers rejected
   * - if ACCEPTED:
   *    - mark order ACCEPTED, reject other offers
   *    - create a Razorpay order & local transaction and return it (frontend shows payment modal)
   */
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

    // ACCEPTED
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { pharmacyId, status: OrderStatus.ACCEPTED },
    });

    await this.prisma.orderOffer.updateMany({
      where: { orderId, pharmacyId: { not: pharmacyId } },
      data: { status: 'REJECTED' },
    });

    // Notify customer to pay
    await this.notify.create(
      updated.customerId,
      'ORDER_ACCEPTED',
      `Your order #${orderId} was accepted by the pharmacy. Please complete payment.`,
      { orderId },
      pharmacyId,
    );

    // Create Razorpay order + local transaction and return payment info to caller
    try {
      const payment = await this.payments.createPaymentForOrder(orderId);
      this.ws.notifyUser(updated.customerId, 'payment_required', { orderId, payment });
      return { order: updated, payment };
    } catch (err) {
      this.logger.warn('Failed to create payment order after pharmacy accept', (err as any)?.message ?? err);
      return { order: updated, paymentError: (err as any)?.message ?? String(err) };
    }
  }

  /**
   * riderRespond: riders accept/reject (manual)
   */
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
        data: { riderId, status: OrderStatus.OUT_FOR_DELIVERY },
      });
    }

    await this.prisma.orderOffer.updateMany({
      where: { orderId, riderId },
      data: { status: 'REJECTED' },
    });
    return { ok: true };
  }

  /**
   * findByUser: returns user-specific orders
   */
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
