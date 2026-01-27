import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { WsGateway } from '../ws/ws.gateway';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersStageSlaCron {
  private readonly logger = new Logger(OrdersStageSlaCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ws: WsGateway,
    private readonly config: ConfigService,
  ) {}

  private minutes(key: string, def: number, min = 1, max = 24 * 60) {
    const raw = this.config.get<string>(key) ?? (process.env as any)[key];
    const n = Number(raw ?? def);
    if (!Number.isFinite(n)) return def;
    return Math.min(Math.max(Math.floor(n), min), max);
  }

  private breachKey(orderId: number, stage: OrderStatus) {
    return `order:sla_stage:${orderId}:${String(stage)}`;
  }

  private async oncePerHour(orderId: number, stage: OrderStatus) {
    try {
      const ok = await this.redis.client.set(
        this.breachKey(orderId, stage),
        String(Date.now()),
        { NX: true, EX: 60 * 60 },
      );
      return !!ok;
    } catch {
      return true; // if redis is down, do not block logging
    }
  }

  private async recordBreach(order: any, stage: OrderStatus, minutes: number, since: Date) {
    const ageSec = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));

    await this.prisma.orderTimeline.create({
      data: {
        orderId: order.id,
        event: 'STAGE_SLA_BREACHED',
        data: JSON.stringify({
          stage,
          minutes,
          ageSec,
          riderId: order.riderId ?? null,
          pharmacyId: order.pharmacyId ?? null,
        }),
      },
    });

    this.ws.notifyAdmins('order.stage_sla_breached', {
      orderId: order.id,
      stage,
      minutes,
      ageSec,
      riderId: order.riderId ?? null,
      pharmacyId: order.pharmacyId ?? null,
    });
  }

  @Cron('*/1 * * * *') // every minute
  async handleStageSlas() {
    if (process.env.DISABLE_SLA === '1') return;

    const reachMin = this.minutes('RIDER_REACH_PHARMACY_SLA_MINUTES', 15, 1, 180);
    const handoverMin = this.minutes('PHARMACY_HANDOVER_SLA_MINUTES', 10, 1, 180);
    const startDeliveryMin = this.minutes('RIDER_START_DELIVERY_SLA_MINUTES', 10, 1, 180);
    const deliverMin = this.minutes('RIDER_DELIVER_SLA_MINUTES', 60, 5, 24 * 60);

    const now = Date.now();
    const cutoffReach = new Date(now - reachMin * 60_000);
    const cutoffHandover = new Date(now - handoverMin * 60_000);
    const cutoffStart = new Date(now - startDeliveryMin * 60_000);
    const cutoffDeliver = new Date(now - deliverMin * 60_000);

    // ASSIGNED -> REACHED_PHARMACY
    const reachOverdue = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.ASSIGNED,
        riderId: { not: null },
        riderAssignedAt: { lt: cutoffReach },
        deletedAt: null,
      } as any,
      select: { id: true, riderId: true, pharmacyId: true, riderAssignedAt: true } as any,
      take: 200,
    });

    for (const o of reachOverdue as any[]) {
      if (!(await this.oncePerHour(o.id, OrderStatus.ASSIGNED))) continue;
      try {
        await this.recordBreach(o, OrderStatus.ASSIGNED, reachMin, o.riderAssignedAt);
      } catch (e: any) {
        this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
      }
    }

    // REACHED_PHARMACY -> PICKED_UP (pharmacy confirm handover)
    const handoverOverdue = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.REACHED_PHARMACY,
        reachedPharmacyAt: { lt: cutoffHandover },
        deletedAt: null,
      } as any,
      select: { id: true, riderId: true, pharmacyId: true, reachedPharmacyAt: true } as any,
      take: 200,
    });

    for (const o of handoverOverdue as any[]) {
      if (!(await this.oncePerHour(o.id, OrderStatus.REACHED_PHARMACY))) continue;
      try {
        await this.recordBreach(o, OrderStatus.REACHED_PHARMACY, handoverMin, o.reachedPharmacyAt);
      } catch (e: any) {
        this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
      }
    }

    // PICKED_UP -> OUT_FOR_DELIVERY
    const startOverdue = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PICKED_UP,
        pickedUpAt: { lt: cutoffStart },
        deletedAt: null,
      } as any,
      select: { id: true, riderId: true, pharmacyId: true, pickedUpAt: true } as any,
      take: 200,
    });

    for (const o of startOverdue as any[]) {
      if (!(await this.oncePerHour(o.id, OrderStatus.PICKED_UP))) continue;
      try {
        await this.recordBreach(o, OrderStatus.PICKED_UP, startDeliveryMin, o.pickedUpAt);
      } catch (e: any) {
        this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
      }
    }

    // OUT_FOR_DELIVERY -> DELIVERED
    const deliverOverdue = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.OUT_FOR_DELIVERY,
        outForDeliveryAt: { lt: cutoffDeliver },
        deletedAt: null,
      } as any,
      select: { id: true, riderId: true, pharmacyId: true, outForDeliveryAt: true } as any,
      take: 200,
    });

    for (const o of deliverOverdue as any[]) {
      if (!(await this.oncePerHour(o.id, OrderStatus.OUT_FOR_DELIVERY))) continue;
      try {
        await this.recordBreach(o, OrderStatus.OUT_FOR_DELIVERY, deliverMin, o.outForDeliveryAt);
      } catch (e: any) {
        this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
      }
    }

    const total =
      reachOverdue.length +
      handoverOverdue.length +
      startOverdue.length +
      deliverOverdue.length;
    if (total > 0) this.logger.debug(`Stage SLA scan found ${total} overdue orders`);
  }
}
