import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { ConfigService } from '@nestjs/config';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/pharmacies/settlements')
export class AdminPharmacySettlementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
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

  @Get()
  async list(
    @Query('days') daysRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('onlyUnsettled') onlyUnsettledRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw || 100), 1), 500);
    const days = Math.min(Math.max(Number(daysRaw || 90), 1), 365);
    const onlyUnsettled = String(onlyUnsettledRaw || '').toLowerCase() === 'true';

    const from = new Date();
    from.setDate(from.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        createdAt: { gte: from },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        id: true,
        pharmacyId: true,
        customerId: true,
        totalPrice: true,
        paymentStatus: true,
        createdAt: true,
        deliveredAt: true,
        pharmacy: { select: { id: true, name: true, email: true } },
      },
    });

    const orderIds = orders.map((o) => o.id);
    const settledEvents = orderIds.length
      ? await this.prisma.orderTimeline.findMany({
          where: {
            orderId: { in: orderIds },
            event: { in: ['ADMIN_SETTLED_ORDER', 'ADMIN_UNSETTLED_ORDER'] },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const settledByOrder = new Map<number, { settled: boolean; at: Date }>();
    for (const e of settledEvents) {
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
          take: 5000,
        })
      : [];

    const refundedOrders = new Set<number>();
    for (const t of txs) {
      const oid = t.orderId != null ? Number(t.orderId) : NaN;
      if (!Number.isFinite(oid)) continue;
      if (String(t.status || '').toUpperCase() === 'REFUNDED') {
        refundedOrders.add(oid);
      }
    }

    const commissionPct = this.commissionPct();
    const rows = orders
      .map((o) => {
        const settled = settledByOrder.get(o.id);
        const refunded = refundedOrders.has(o.id);
        const gross = refunded ? 0 : Number(o.totalPrice ?? 0);
        const commissionAmount = refunded
          ? 0
          : Number(((gross * commissionPct) / 100).toFixed(2));
        const netPayout = refunded ? 0 : Number((gross - commissionAmount).toFixed(2));

        return {
          orderId: o.id,
          pharmacyId: o.pharmacyId,
          pharmacy: o.pharmacy,
          totalPrice: Number(o.totalPrice ?? 0),
          paymentStatus: String(o.paymentStatus || '').toUpperCase(),
          createdAt: o.createdAt,
          deliveredAt: o.deliveredAt,
          refunded,
          commissionPct,
          commissionAmount,
          netPayout,
          settled: Boolean(settled?.settled),
          settledAt: settled?.settled ? settled.at : null,
        };
      })
      .filter((r) => (onlyUnsettled ? !r.settled : true))
      .slice(0, take);

    const totals = rows.reduce(
      (acc, r) => {
        acc.gross += r.refunded ? 0 : r.totalPrice;
        acc.commission += r.commissionAmount;
        acc.net += r.netPayout;
        if (!r.settled) acc.unsettledNet += r.netPayout;
        return acc;
      },
      { gross: 0, commission: 0, net: 0, unsettledNet: 0 },
    );

    return {
      take,
      total: rows.length,
      commissionPct,
      totals: {
        gross: Number(totals.gross.toFixed(2)),
        commission: Number(totals.commission.toFixed(2)),
        net: Number(totals.net.toFixed(2)),
        unsettledNet: Number(totals.unsettledNet.toFixed(2)),
      },
      rows,
    };
  }

  @Patch(':orderId/settle')
  async settle(
    @Param('orderId') orderIdRaw: string,
    @Body() body: { note?: string; force?: boolean },
    @Req() req: any,
  ) {
    const orderId = Number(orderIdRaw);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order id');

    return this.orders.adminSettleOrder(orderId, Number(req.user?.id), {
      note: body?.note,
      force: Boolean(body?.force),
    });
  }

  @Patch(':orderId/unsettle')
  async unsettle(
    @Param('orderId') orderIdRaw: string,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    const orderId = Number(orderIdRaw);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order id');

    return this.orders.adminUnsettleOrder(orderId, Number(req.user?.id), {
      note: body?.note,
    });
  }
}
