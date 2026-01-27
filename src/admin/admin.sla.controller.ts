import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';
import { PrismaService } from '../utils/prisma.service';
import { OrderStatus, UserRole } from '@prisma/client';

@Controller('admin/sla')
@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'OPS')
export class AdminSlaController {
  constructor(private readonly prisma: PrismaService) {}

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

    const pharmacySla = this.clampInt(process.env.PHARMACY_ACCEPT_SLA_MINUTES, 10, 1, 180);
    const riderReachSla = this.clampInt(process.env.RIDER_REACH_PHARMACY_SLA_MINUTES, 20, 1, 300);
    const pickupSla = this.clampInt(process.env.PHARMACY_HANDOVER_SLA_MINUTES, 15, 1, 180);
    const deliverySla = this.clampInt(process.env.RIDER_DELIVERY_SLA_MINUTES, 90, 5, 24 * 60);

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

  private parseTimelineData(data?: string | null) {
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  @Get('summary')
  async summary(@Query('hours') hoursRaw?: string) {
    const windowHours = this.clampInt(hoursRaw, 24, 1, 168);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const recent = await this.prisma.orderTimeline.findMany({
      where: { event: 'STAGE_SLA_BREACHED', createdAt: { gte: since } },
      select: { id: true, orderId: true, event: true, data: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const byStage: Record<string, number> = {};
    const perHour: Record<string, number> = {};

    for (const e of recent as any[]) {
      const parsed = this.parseTimelineData(e.data);
      const stage = String(parsed?.stage || 'UNKNOWN').toUpperCase();
      byStage[stage] = (byStage[stage] || 0) + 1;

      const d = new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      perHour[key] = (perHour[key] || 0) + 1;
    }

    // Open breaches (live)
    const openOrders: any[] = await this.prisma.order.findMany({
      where: {
        deletedAt: null,
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELED, OrderStatus.REJECTED],
        },
      } as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        status: true,
        createdAt: true,
        customerId: true,
        pharmacyId: true,
        riderId: true,
        riderAssignedAt: true,
        reachedPharmacyAt: true,
        pickedUpAt: true,
        outForDeliveryAt: true,
        customer: { select: { name: true, email: true, phone: true } },
        pharmacy: { select: { name: true, email: true, phone: true } },
        rider: { select: { name: true, email: true, phone: true } },
      } as any,
    });

    const openBreaches = openOrders
      .map((o) => ({ ...o, sla: this.slaFor(o), stageStartedAt: this.stageStart(o) }))
      .filter((o) => o.sla.severity === 'BREACH')
      .slice(0, 100);

    const topStages = Object.entries(byStage)
      .sort((a, b) => b[1] - a[1])
      .map(([stage, count]) => ({ stage, count }));

    const trend = Object.entries(perHour)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count }));

    return {
      windowHours,
      breachedEvents: recent.length,
      byStage: topStages,
      trend,
      openBreachesCount: openBreaches.length,
      openBreaches,
    };
  }

  @Get('breaches')
  async breaches(@Query('take') takeRaw?: string) {
    const take = this.clampInt(takeRaw, 200, 1, 1000);
    const rows = await this.prisma.orderTimeline.findMany({
      where: { event: 'STAGE_SLA_BREACHED' },
      select: { id: true, orderId: true, event: true, data: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return {
      items: (rows as any[]).map((r) => {
        const parsed = this.parseTimelineData(r.data);
        return {
          id: r.id,
          orderId: r.orderId,
          createdAt: r.createdAt,
          stage: parsed?.stage ?? null,
          minutes: parsed?.minutes ?? null,
          ageSec: parsed?.ageSec ?? null,
          riderId: parsed?.riderId ?? null,
          pharmacyId: parsed?.pharmacyId ?? null,
        };
      }),
    };
  }
}

