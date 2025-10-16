import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AnalyticsService {
  // 📊 Dashboard summary
  async getSummary() {
    const [
      users,
      pharmacies,
      riders,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.pharmacy.count(),
      prisma.rider.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'delivered' } }),
      prisma.order.count({ where: { status: 'cancelled' } }),
    ]);

    const deliveryRate =
      totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0';

    return {
      users,
      pharmacies,
      riders,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      deliveryRate: `${deliveryRate}%`,
    };
  }

  // 📈 Orders grouped by day (last 7 days)
  async getOrderTrends() {
    const last7Days = await prisma.$queryRaw<
      { date: string; count: number }[]
    >`
      SELECT 
        to_char("createdAt", 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY date
      ORDER BY date ASC;
    `;

    return last7Days;
  }

  // 💰 Pharmacy order performance
  async getTopPharmacies() {
    const topPharmacies = await prisma.$queryRaw<
      { name: string; total_orders: number }[]
    >`
      SELECT p.name, COUNT(o.id)::int AS total_orders
      FROM "Order" o
      JOIN "Pharmacy" p ON o."pharmacyId" = p.id
      GROUP BY p.name
      ORDER BY total_orders DESC
      LIMIT 5;
    `;
    return topPharmacies;
  }
}
