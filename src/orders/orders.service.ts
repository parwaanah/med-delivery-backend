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
        where: { pharmacyId, status: 'ACCEPTED', updatedAt: { gte: since } },
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

    /** 1) DIRECT PHARMACY ORDER — unchanged */
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

      try {
        await this.geoSurge.removePoint(orderGeoId);
      } catch {}

      return order;
    }

    /** 2) SMART AUTO-ROUTING (A2) */
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

    const order = await this.prisma.order.create({
      data: {
        customer: { connect: { id: +customerId } },
        pharmacy: { connect: { id: bestPharmacyId } },
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

    /** Send offers to all matching pharmacies */
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

    /** 3) AUTO-ASSIGN RIDER (A2) */
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

        for (const cand of riderScores.slice(0, 5)) {
          const match = cand.point.memberId.match(/^rider:(\d+)$/);
          if (!match) continue;
          const riderId = Number(match[1]);

          const r = await this.prisma.user.findUnique({
            where: { id: riderId },
            select: { status: true },
          });

          if (!r || r.status !== 'AVAILABLE') continue;

          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              riderId,
              status: 'OUT_FOR_DELIVERY',
            },
          });

          await this.prisma.user.update({
            where: { id: riderId },
            data: { status: 'BUSY' },
          });

          await this.notify.create(
            riderId,
            'ORDER_ASSIGNED',
            `You were assigned to order #${order.id}`,
            { orderId: order.id },
            undefined, // <-- fixed: pass undefined rather than null for optional actor param
          );

          this.ws.notifyUser(riderId, 'order_assigned', {
            orderId: order.id,
          });

          break;
        }
      }
    } catch (err) {
      this.logger.warn('Auto-assign rider failed:', (err as any)?.message ?? err);
    }

    try {
      await this.geoSurge.removePoint(orderGeoId);
    } catch {}

    return { order, candidates: pharmacyIds, scores };
  }

  async updateStage(
    riderId: number,
    orderId: number,
    stage: 'REACHED_PHARMACY' | 'PICKED_UP' | 'DELIVERED',
    location?: { lat: number; lng: number },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
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

    return updated;
  }

  async pharmacyRespond(
    pharmacyId: number,
    orderId: number,
    action: 'ACCEPTED' | 'REJECTED',
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found.');

    if (action === 'REJECTED') {
      await this.prisma.orderOffer.updateMany({
        where: { orderId, pharmacyId },
        data: { status: 'REJECTED' },
      });
      return { ok: true };
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { pharmacyId, status: 'ACCEPTED' },
    });

    await this.prisma.orderOffer.updateMany({
      where: { orderId, pharmacyId: { not: pharmacyId } },
      data: { status: 'REJECTED' },
    });

    return updated;
  }

  async riderRespond(
    riderId: number,
    orderId: number,
    action: 'ACCEPTED' | 'REJECTED',
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
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
