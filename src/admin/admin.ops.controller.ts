import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { AuditService } from '../utils/audit.service';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';

@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'OPS')
@Controller('admin/ops')
export class AdminOpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  private clampInt(v: unknown, def: number, min: number, max: number) {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, Math.floor(n)));
  }

  private stageStart(order: any) {
    const status = String(order?.status || '').toUpperCase();

    if (status === 'ASSIGNED') return order.riderAssignedAt ?? order.createdAt;
    if (status === 'REACHED_PHARMACY')
      return order.reachedPharmacyAt ?? order.riderAssignedAt ?? order.createdAt;
    if (status === 'PICKED_UP')
      return order.pickedUpAt ?? order.reachedPharmacyAt ?? order.createdAt;
    if (status === 'OUT_FOR_DELIVERY')
      return order.outForDeliveryAt ?? order.pickedUpAt ?? order.createdAt;

    return order.createdAt;
  }

  private slaFor(order: any) {
    const status = String(order?.status || '').toUpperCase();
    const startedAt: Date = this.stageStart(order) ?? new Date(order.createdAt);
    const ageMin = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));

    const pharmacySla = this.clampInt(
      process.env.PHARMACY_ACCEPT_SLA_MINUTES,
      10,
      1,
      180,
    );
    const riderReachSla = this.clampInt(
      process.env.RIDER_REACH_PHARMACY_SLA_MINUTES,
      20,
      1,
      300,
    );
    const pickupSla = this.clampInt(
      process.env.PHARMACY_HANDOVER_SLA_MINUTES,
      15,
      1,
      180,
    );
    const deliverySla = this.clampInt(
      process.env.RIDER_DELIVERY_SLA_MINUTES,
      90,
      5,
      24 * 60,
    );

    let threshold = 0;
    let label = 'Stage SLA';

    if (status === 'PENDING') {
      threshold = pharmacySla;
      label = 'Pharmacy response SLA';
    } else if (status === 'ASSIGNED') {
      threshold = riderReachSla;
      label = 'Rider reach pharmacy SLA';
    } else if (status === 'REACHED_PHARMACY') {
      threshold = pickupSla;
      label = 'Handover SLA';
    } else if (status === 'OUT_FOR_DELIVERY') {
      threshold = deliverySla;
      label = 'Delivery SLA';
    } else {
      return { severity: 'OK', label, thresholdMinutes: 0, ageMinutes: ageMin };
    }

    const severity =
      ageMin >= threshold ? 'BREACH' : ageMin >= Math.max(1, Math.floor(threshold * 0.75)) ? 'WARN' : 'OK';

    return { severity, label, thresholdMinutes: threshold, ageMinutes: ageMin };
  }

  @Get('live-orders')
  async liveOrders(
    @Query('take') takeRaw?: string,
    @Query('onlyBreached') onlyBreachedRaw?: string,
  ) {
    const take = this.clampInt(takeRaw, 50, 1, 200);
    const onlyBreached = String(onlyBreachedRaw || '').toLowerCase() === 'true';

    const orders: any[] = await this.prisma.order.findMany(({
      where: {
        deletedAt: null,
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELED, OrderStatus.REJECTED],
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        totalPrice: true,
        createdAt: true,
        customerId: true,
        pharmacyId: true,
        riderId: true,
        riderAssignedAt: true,
        reachedPharmacyAt: true,
        pickedUpAt: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        customer: { select: { name: true, email: true, phone: true } },
        pharmacy: { select: { name: true, email: true, phone: true } },
        rider: { select: { name: true, email: true, phone: true } },
      },
    } as any));

    const txs = await this.prisma.transaction.findMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const refundedSet = new Set<number>();
    for (const t of txs as any[]) {
      const oid = t.orderId != null ? Number(t.orderId) : NaN;
      if (!Number.isFinite(oid)) continue;
      if (String(t.status || '').toUpperCase() === 'REFUNDED') refundedSet.add(oid);
    }

    const rows = orders
      .map((o) => {
        const sla = this.slaFor(o);
        return {
          ...o,
          refunded: refundedSet.has(o.id),
          stageStartedAt: this.stageStart(o),
          sla,
        };
      })
      .filter((o) => (onlyBreached ? o.sla.severity === 'BREACH' : true));

    return { take, total: rows.length, orders: rows };
  }

  @Post('orders/:id/reassign/:riderId')
  async reassign(
    @Param('id') id: string,
    @Param('riderId') riderId: string,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    const rid = Number(riderId);
    if (!Number.isFinite(orderId) || !Number.isFinite(rid)) {
      throw new BadRequestException('Invalid ids');
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new BadRequestException('Order not found');

    if (order.riderId) {
      await this.orders.adminUnassignRider(orderId, req.user.id);
    }
    const res = await this.orders.adminAssign(orderId, req.user.id, rid);

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_FORCE_REASSIGN_RIDER',
      resource: `order:${orderId}`,
      meta: {
        fromRiderId: order.riderId ?? null,
        toRiderId: rid,
        note: body?.note,
      },
    });

    return res;
  }

  @Post('orders/:id/complete-delivery')
  async completeDelivery(
    @Param('id') id: string,
    @Body()
    body: {
      note?: string;
      proofUrl?: string;
      signatureUrl?: string;
      otp?: string;
    },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminCompleteDelivery(orderId, req.user.id, {
      note: body?.note,
      proofUrl: body?.proofUrl,
      signatureUrl: body?.signatureUrl,
      otp: body?.otp,
    });

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_MANUAL_DELIVERY_COMPLETE',
      resource: `order:${orderId}`,
      meta: { note: body?.note },
    });

    return res;
  }

  @Post('orders/:id/emergency-refund')
  async emergencyRefund(
    @Param('id') id: string,
    @Body() body: { amount?: number; note?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order id');

    const tx = await this.prisma.transaction.findFirst({
      where: { orderId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });
    if (!tx) throw new BadRequestException('No SUCCESS transaction found for this order');

    const res = await this.payments.refundTransaction(
      tx.id,
      body?.amount,
      Number(req.user.id),
    );

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_EMERGENCY_REFUND',
      resource: `order:${orderId}`,
      meta: { transactionId: tx.id, amount: body?.amount, note: body?.note },
    });

    return res;
  }

  @Post('orders/:id/escalate-sla')
  async escalateSla(
    @Param('id') id: string,
    @Body() body: { reason?: string; note?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminEscalateSla(orderId, req.user.id, {
      reason: body?.reason,
      note: body?.note,
    });

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_SLA_ESCALATED',
      resource: `order:${orderId}`,
      meta: { reason: body?.reason, note: body?.note },
    });

    return res;
  }
}
