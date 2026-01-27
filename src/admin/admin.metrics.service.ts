import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { UserRole, OrderStatus } from '@prisma/client';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class AdminMetricsService {
  constructor(private prisma: PrismaService) {}

  async getMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      usersCount,
      ordersToday,
      ordersTotal,
      revenueAgg,
      activeRiders,
    ] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.order.count({
        where: { createdAt: { gte: today } },
      }),

      this.prisma.order.count(),

      this.prisma.order.aggregate({
        _sum: { totalPrice: true },
        where: { status: OrderStatus.DELIVERED },
      }),

      this.prisma.user.count({
        where: ({
          role: UserRole.RIDER,
          status: 'ACTIVE',
          riderAvailability: 'AVAILABLE',
        } as any),
      }),
    ]);

    return {
      users: { count: usersCount },
      ordersToday: { count: ordersToday },
      ordersTotal: { count: ordersTotal },
      revenue: { amount: revenueAgg._sum.totalPrice ?? 0 },
      activeRiders: { count: activeRiders },
      surgeMultiplier: 1,
    };
  }

  // ✅ REQUIRED FOR admin.metrics.listener.ts
  async emitMetrics(ws: WsGateway) {
    const metrics = await this.getMetrics();
    ws.notifyAdmins('admin_metrics', metrics);
    return metrics;
  }
}
