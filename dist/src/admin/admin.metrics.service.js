"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMetricsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const client_1 = require("@prisma/client");
let AdminMetricsService = class AdminMetricsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMetrics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [usersCount, ordersToday, ordersTotal, revenueAgg, activeRiders,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.order.count({
                where: { createdAt: { gte: today } },
            }),
            this.prisma.order.count(),
            this.prisma.order.aggregate({
                _sum: { totalPrice: true },
                where: { status: client_1.OrderStatus.DELIVERED },
            }),
            this.prisma.user.count({
                where: {
                    role: client_1.UserRole.RIDER,
                    status: 'ACTIVE',
                    riderAvailability: 'AVAILABLE',
                },
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
    async emitMetrics(ws) {
        const metrics = await this.getMetrics();
        ws.notifyAdmins('admin_metrics', metrics);
        return metrics;
    }
};
exports.AdminMetricsService = AdminMetricsService;
exports.AdminMetricsService = AdminMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminMetricsService);
