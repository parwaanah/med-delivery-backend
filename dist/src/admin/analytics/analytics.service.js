"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
let AnalyticsService = class AnalyticsService {
    async getSummary() {
        const [users, pharmacies, riders, totalOrders, deliveredOrders, cancelledOrders,] = await Promise.all([
            prisma.user.count(),
            prisma.pharmacy.count(),
            prisma.rider.count(),
            prisma.order.count(),
            prisma.order.count({ where: { status: 'delivered' } }),
            prisma.order.count({ where: { status: 'cancelled' } }),
        ]);
        const deliveryRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0';
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
    async getOrderTrends() {
        const last7Days = await prisma.$queryRaw `
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
    async getTopPharmacies() {
        const topPharmacies = await prisma.$queryRaw `
      SELECT p.name, COUNT(o.id)::int AS total_orders
      FROM "Order" o
      JOIN "Pharmacy" p ON o."pharmacyId" = p.id
      GROUP BY p.name
      ORDER BY total_orders DESC
      LIMIT 5;
    `;
        return topPharmacies;
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)()
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map