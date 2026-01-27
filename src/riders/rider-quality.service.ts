import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { NotificationService } from '../utils/notification.service';
import { AuditService } from '../utils/audit.service';
import { OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class RiderQualityService {
  private readonly logger = new Logger(RiderQualityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsGateway,
    private readonly notify: NotificationService,
    private readonly audit: AuditService,
  ) {}

  private strikeWindowDays() {
    const n = Number(process.env.RIDER_STRIKE_WINDOW_DAYS || 30);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 365) : 30;
  }

  private suspendThresholdPoints() {
    const n = Number(process.env.RIDER_STRIKE_SUSPEND_POINTS || 10);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 200) : 10;
  }

  private rapidRejectWindowSec() {
    const n = Number(process.env.RIDER_RAPID_REJECT_WINDOW_SEC || 300);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 30), 3600) : 300;
  }

  private rapidRejectThreshold() {
    const n = Number(process.env.RIDER_RAPID_REJECT_THRESHOLD || 3);
    return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 50) : 3;
  }

  private async strikePointsSince(riderId: number, since: Date) {
    const agg = await (this.prisma as any).riderStrike.aggregate({
      where: { riderId, createdAt: { gte: since } },
      _sum: { points: true },
    });
    return Number(agg?._sum?.points ?? 0);
  }

  private async maybeAutoSuspend(riderId: number, meta?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: riderId },
      select: ({ id: true, role: true, status: true } as any),
    });
    if (!user || String((user as any).role) !== String(UserRole.RIDER)) return;
    if (String((user as any).status).toUpperCase() === 'SUSPENDED') return;

    const since = new Date(
      Date.now() - this.strikeWindowDays() * 24 * 60 * 60 * 1000,
    );
    const points = await this.strikePointsSince(riderId, since);
    const threshold = this.suspendThresholdPoints();
    if (points < threshold) return;

    await this.prisma.user.update(({
      where: { id: riderId },
      data: {
        status: 'SUSPENDED',
        riderAvailability: 'OFFLINE',
        riderReasonCode: 'FRAUD',
        riderReasonNote: `Auto-suspended: strike points ${points}/${threshold}`,
      },
    } as any));

    this.ws.notifyUser(riderId, 'user.status', { status: 'SUSPENDED' });
    this.ws.notifyAdmins('rider.auto_suspended', {
      riderId,
      points,
      threshold,
      meta: meta ?? null,
    });

    try {
      await this.notify.create(
        riderId,
        'ACCOUNT_SUSPENDED',
        'Your rider account was suspended due to safety policy violations. Contact support.',
        { code: 'FRAUD', points, threshold, meta },
        undefined,
      );
    } catch {}

    try {
      await this.audit.logAdminAction({
        action: 'RIDER_AUTO_SUSPENDED',
        resource: `rider:${riderId}`,
        meta: { points, threshold, ...(meta || {}) },
      });
    } catch {}
  }

  async recordRating(params: {
    customerId: number;
    orderId: number;
    rating: number;
    comment?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.customerId !== params.customerId) {
      throw new ForbiddenException('Not your order');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Order not delivered yet');
    }
    if (!order.riderId) {
      throw new BadRequestException('Order has no rider');
    }

    const rating = Math.floor(Number(params.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be 1..5');
    }

    const comment =
      params.comment != null ? String(params.comment).trim().slice(0, 500) : null;

    const existing = await (this.prisma as any).riderRating.findUnique({
      where: { orderId: params.orderId },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Rating already submitted');

    await (this.prisma as any).riderRating.create({
      data: {
        orderId: params.orderId,
        riderId: order.riderId,
        customerId: params.customerId,
        rating,
        comment,
      },
    });

    const rider = await this.prisma.user.findUnique({
      where: { id: order.riderId },
      select: ({ id: true, riderAvgRating: true, riderRatingCount: true } as any),
    });

    const count = Number((rider as any)?.riderRatingCount ?? 0);
    const avg = Number((rider as any)?.riderAvgRating ?? 0);
    const nextCount = count + 1;
    const nextAvg = nextCount > 0 ? (avg * count + rating) / nextCount : rating;

    await this.prisma.user.update(({
      where: { id: order.riderId },
      data: { riderAvgRating: Number(nextAvg.toFixed(2)), riderRatingCount: nextCount },
    } as any));

    this.ws.notifyAdmins('rider.rating', {
      riderId: order.riderId,
      orderId: params.orderId,
      rating,
      avg: Number(nextAvg.toFixed(2)),
      count: nextCount,
    });

    return { ok: true };
  }

  async addStrike(params: {
    riderId: number;
    type: string;
    points: number;
    reason?: string;
    meta?: any;
  }) {
    const points = Math.min(Math.max(Math.floor(Number(params.points || 1)), 1), 100);
    const type = String(params.type || 'UNKNOWN').slice(0, 60);
    const reason =
      params.reason != null ? String(params.reason).trim().slice(0, 200) : null;

    await (this.prisma as any).riderStrike.create({
      data: {
        riderId: params.riderId,
        type,
        points,
        reason,
        meta: params.meta ?? null,
      },
    });

    this.ws.notifyAdmins('rider.strike', {
      riderId: params.riderId,
      type,
      points,
      reason,
    });

    await this.maybeAutoSuspend(params.riderId, { type, points, reason, meta: params.meta });
    return { ok: true };
  }

  async addFraudSignal(params: {
    riderId: number;
    type: string;
    severity?: number;
    meta?: any;
    strikePoints?: number;
    reason?: string;
  }) {
    const type = String(params.type || 'UNKNOWN').slice(0, 60);
    const severity = Math.min(
      Math.max(Math.floor(Number(params.severity ?? 50)), 1),
      100,
    );

    await (this.prisma as any).riderFraudSignal.create({
      data: {
        riderId: params.riderId,
        type,
        severity,
        meta: params.meta ?? null,
      },
    });

    this.ws.notifyAdmins('rider.fraud', {
      riderId: params.riderId,
      type,
      severity,
      meta: params.meta ?? null,
    });

    if (params.strikePoints && params.strikePoints > 0) {
      await this.addStrike({
        riderId: params.riderId,
        type,
        points: params.strikePoints,
        reason: params.reason,
        meta: params.meta,
      });
    } else {
      await this.maybeAutoSuspend(params.riderId, { type, severity, meta: params.meta });
    }

    return { ok: true };
  }

  async onRiderRejectedOffer(riderId: number) {
    const windowSec = this.rapidRejectWindowSec();
    const threshold = this.rapidRejectThreshold();
    const since = new Date(Date.now() - windowSec * 1000);

    const count = await this.prisma.orderOffer.count(({
      where: {
        riderId,
        offeredTo: 'RIDER',
        status: 'REJECTED',
        respondedAt: { gte: since },
      },
    } as any));

    if (count < threshold) return { ok: true };

    await this.addFraudSignal({
      riderId,
      type: 'RAPID_REJECTS',
      severity: 70,
      strikePoints: 3,
      reason: `Rejected ${count} offers in ${windowSec}s`,
      meta: { count, windowSec },
    });

    return { ok: true };
  }

  async summary(riderId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: riderId },
      select: ({ id: true, status: true, riderAvgRating: true, riderRatingCount: true } as any),
    });
    if (!user) throw new BadRequestException('Rider not found');

    const since = new Date(
      Date.now() - this.strikeWindowDays() * 24 * 60 * 60 * 1000,
    );
    const strikePoints30d = await this.strikePointsSince(riderId, since);

    const recentSignals = await (this.prisma as any).riderFraudSignal.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recentStrikes = await (this.prisma as any).riderStrike.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      riderId,
      status: (user as any).status,
      rating: {
        avg: Number((user as any).riderAvgRating ?? 0),
        count: Number((user as any).riderRatingCount ?? 0),
      },
      strikes: {
        windowDays: this.strikeWindowDays(),
        suspendThresholdPoints: this.suspendThresholdPoints(),
        pointsInWindow: strikePoints30d,
        recent: recentStrikes,
      },
      fraudSignals: recentSignals,
    };
  }
}
