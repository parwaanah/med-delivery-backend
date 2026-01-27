// src/pharmacies/pharmacy-earnings.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderStatus, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Controller('pharmacy/earnings')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard)
@Roles(UserRole.PHARMACY)
export class PharmacyEarningsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private commissionPct() {
    const raw =
      this.config.get<string>('PHARMACY_COMMISSION_PCT') ??
      process.env.PHARMACY_COMMISSION_PCT ??
      '10';
    const pct = Number(raw);
    if (!Number.isFinite(pct)) return 10;
    return Math.min(Math.max(pct, 0), 100);
  }

  @Get('summary')
  async summary(@Req() req: Request & { user: any }) {
    const pharmacyId = Number(req.user?.id);
    const commissionPct = this.commissionPct();

    const [totalOrders, delivered] = await Promise.all([
      this.prisma.order.count({ where: { pharmacyId } }),
      this.prisma.order.findMany({
        where: { pharmacyId, status: OrderStatus.DELIVERED },
        select: { id: true, createdAt: true, totalPrice: true },
        take: 5000,
      }),
    ]);

    const deliveredIds = delivered.map((o) => o.id);
    const refunded = deliveredIds.length
      ? await this.prisma.transaction.findMany({
          where: { orderId: { in: deliveredIds }, status: 'REFUNDED' },
          select: { orderId: true },
        })
      : [];

    const refundedSet = new Set<number>();
    for (const r of refunded) {
      if (r.orderId != null) refundedSet.add(Number(r.orderId));
    }

    const eligible = delivered.filter((o) => !refundedSet.has(o.id));
    const completedOrders = eligible.length;
    const revenue = eligible.reduce((acc, o) => acc + Number(o.totalPrice || 0), 0);

    const deliveredLast7 = (() => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);

      const byDay = new Map<
        string,
        { date: string; revenue: number; completedOrders: number }
      >();

      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        byDay.set(key, { date: key, revenue: 0, completedOrders: 0 });
      }

      for (const o of eligible) {
        if (o.createdAt < start) continue;
        const key = o.createdAt.toISOString().slice(0, 10);
        const cur =
          byDay.get(key) ?? { date: key, revenue: 0, completedOrders: 0 };
        cur.revenue += Number(o.totalPrice || 0);
        cur.completedOrders += 1;
        byDay.set(key, cur);
      }

      return Array.from(byDay.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
    })();
    const commissionAmount = Number(
      ((revenue * commissionPct) / 100).toFixed(2),
    );
    const netPayout = Number((revenue - commissionAmount).toFixed(2));

    return {
      totalOrders,
      completedOrders,
      revenue,
      commissionPct,
      commissionAmount,
      netPayout,
      last7days: deliveredLast7.map((d) => {
        const c = Number(((d.revenue * commissionPct) / 100).toFixed(2));
        return {
          ...d,
          commissionAmount: c,
          netPayout: Number((d.revenue - c).toFixed(2)),
        };
      }),
    };
  }

  @Get('transactions')
  async transactions(
    @Req() req: Request & { user: any },
    @Query('take') takeRaw?: string,
    @Query('days') daysRaw?: string,
  ) {
    const pharmacyId = Number(req.user?.id);
    const commissionPct = this.commissionPct();
    const take = Math.min(Math.max(Number(takeRaw || 100), 1), 200);
    const days = Math.min(Math.max(Number(daysRaw || 90), 1), 365);

    const from = new Date();
    from.setDate(from.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: { pharmacyId, createdAt: { gte: from } },
      select: { id: true, status: true, totalPrice: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const orderIds = orders.map((o) => o.id);
    if (!orderIds.length) {
      return { transactions: [] };
    }

    const txs = await this.prisma.transaction.findMany({
      where: { orderId: { in: orderIds } },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const orderMap = new Map<number, (typeof orders)[number]>();
    for (const o of orders) orderMap.set(o.id, o);

    return {
      transactions: txs.map((t) => {
        const orderId = t.orderId != null ? Number(t.orderId) : null;
        const ord = orderId != null ? orderMap.get(orderId) : undefined;

        const refunded = String(t.status || '').toUpperCase() === 'REFUNDED';
        const gross = refunded
          ? 0
          : ord
            ? Number(ord.totalPrice ?? 0)
            : Number(t.amount ?? 0);
        const commissionAmount = refunded
          ? 0
          : Number(((gross * commissionPct) / 100).toFixed(2));
        const netPayout = refunded ? 0 : Number((gross - commissionAmount).toFixed(2));

        return {
          id: t.id,
          provider: t.provider,
          providerOrder: t.providerOrder,
          providerPayment: t.providerPayment,
          amount: Number(t.amount),
          currency: t.currency,
          status: t.status,
          method: t.method,
          createdAt: t.createdAt,
          refunded,
          commissionPct,
          commissionAmount,
          netPayout,
          order: ord
            ? {
                id: ord.id,
                status: ord.status,
                totalPrice: Number(ord.totalPrice),
                createdAt: ord.createdAt,
              }
            : orderId
              ? { id: orderId }
              : null,
        };
      }),
    };
  }

  // Read-only earnings ledger (orders ↔ transactions + net payout)
  @Get('ledger')
  async ledger(
    @Req() req: Request & { user: any },
    @Query('take') takeRaw?: string,
    @Query('days') daysRaw?: string,
  ) {
    const pharmacyId = Number(req.user?.id);
    const commissionPct = this.commissionPct();
    const take = Math.min(Math.max(Number(takeRaw || 50), 1), 200);
    const days = Math.min(Math.max(Number(daysRaw || 90), 1), 365);

    const from = new Date();
    from.setDate(from.getDate() - days);

    const orders = await this.prisma.order.findMany(({
      where: {
        pharmacyId,
        createdAt: { gte: from },
        deliveredAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        deliveredAt: true,
      },
    } as any));

    const orderIds = orders.map((o) => o.id);

    const settlementEvents = orderIds.length
      ? await this.prisma.orderTimeline.findMany({
          where: {
            orderId: { in: orderIds },
            event: { in: ['ADMIN_SETTLED_ORDER', 'ADMIN_UNSETTLED_ORDER'] },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const settledByOrder = new Map<number, { settled: boolean; at: Date }>();
    for (const e of settlementEvents) {
      if (settledByOrder.has(e.orderId)) continue;
      settledByOrder.set(e.orderId, {
        settled: e.event === 'ADMIN_SETTLED_ORDER',
        at: e.createdAt,
      });
    }

    const txs = orderIds.length
      ? await this.prisma.transaction.findMany({
          where: { orderId: { in: orderIds } },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        })
      : [];

    const txByOrder = new Map<number, any[]>();
    const refundedOrders = new Set<number>();
    for (const t of txs as any[]) {
      const oid = t.orderId != null ? Number(t.orderId) : NaN;
      if (!Number.isFinite(oid)) continue;
      if (String(t.status || '').toUpperCase() === 'REFUNDED') {
        refundedOrders.add(oid);
      }
      const list = txByOrder.get(oid) ?? [];
      list.push(t);
      txByOrder.set(oid, list);
    }

    const rows = orders.map((o) => {
      const refunded = refundedOrders.has(o.id);
      const gross = refunded ? 0 : Number(o.totalPrice ?? 0);
      const commissionAmount = refunded
        ? 0
        : Number(((gross * commissionPct) / 100).toFixed(2));
      const netPayout = refunded ? 0 : Number((gross - commissionAmount).toFixed(2));
      const transactions = (txByOrder.get(o.id) ?? []).map((t) => ({
        id: t.id,
        provider: t.provider,
        providerOrder: t.providerOrder,
        providerPayment: t.providerPayment,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        method: t.method,
        createdAt: t.createdAt,
      }));

      const settled = settledByOrder.get(o.id);

      return {
        order: {
          id: o.id,
          status: o.status,
          totalPrice: Number(o.totalPrice ?? 0),
          createdAt: o.createdAt,
          deliveredAt: (o as any).deliveredAt ?? null,
        },
        refunded,
        eligibleForPayout: !refunded,
        settled: Boolean(settled?.settled),
        settledAt: settled?.settled ? settled.at : null,
        commissionPct,
        commissionAmount,
        netPayout,
        transactions,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.gross += r.refunded ? 0 : r.order.totalPrice;
        acc.commission += r.commissionAmount;
        acc.net += r.netPayout;
        return acc;
      },
      { gross: 0, commission: 0, net: 0 },
    );

    return {
      commissionPct,
      totals: {
        gross: Number(totals.gross.toFixed(2)),
        commission: Number(totals.commission.toFixed(2)),
        net: Number(totals.net.toFixed(2)),
      },
      rows,
    };
  }
}
