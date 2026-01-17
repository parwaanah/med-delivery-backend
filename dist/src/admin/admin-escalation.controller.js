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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminEscalationController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const escalation_service_1 = require("./escalation.service");
const orders_service_1 = require("../orders/orders.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let AdminEscalationController = class AdminEscalationController {
    constructor(prisma, esc, orders) {
        this.prisma = prisma;
        this.esc = esc;
        this.orders = orders;
    }
    async getEscalated() {
        const notes = await this.prisma.notification.findMany({
            where: { type: 'ORDER_ESCALATION' },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        const items = [];
        for (const n of notes) {
            const orderId = n.meta?.orderId;
            if (!orderId)
                continue;
            const order = await this.prisma.order.findUnique({
                where: { id: Number(orderId) },
                include: {
                    customer: { select: { email: true } },
                    pharmacy: { select: { email: true } },
                    rider: { select: { email: true } },
                    items: true,
                },
            });
            if (order && !order.riderId) {
                items.push({ notification: n, order });
            }
        }
        return { total: items.length, items };
    }
    async getCandidates(id) {
        const orderId = Number(id);
        if (isNaN(orderId)) {
            throw new common_1.BadRequestException('Invalid order id');
        }
        const candidates = await this.esc.findCandidatesForOrder(orderId, 5, 50);
        const enriched = await Promise.all(candidates.map(async (c) => {
            const riderId = c?.riderId === null || c?.riderId === undefined
                ? null
                : Number(c.riderId);
            if (!riderId)
                return { ...c, user: null };
            const user = await this.prisma.user.findUnique({
                where: { id: riderId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    status: true,
                    latitude: true,
                    longitude: true,
                },
            });
            return { ...c, user };
        }));
        return { total: enriched.length, candidates: enriched };
    }
    async assign(id, riderId, req) {
        const orderId = Number(id);
        const rId = Number(riderId);
        if (isNaN(orderId) || isNaN(rId)) {
            throw new common_1.BadRequestException('Invalid ids');
        }
        const adminId = req.user.id;
        return this.orders.adminAssign(orderId, adminId, rId);
    }
};
exports.AdminEscalationController = AdminEscalationController;
__decorate([
    (0, common_1.Get)('escalated'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminEscalationController.prototype, "getEscalated", null);
__decorate([
    (0, common_1.Get)(':id/riders'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminEscalationController.prototype, "getCandidates", null);
__decorate([
    (0, common_1.Post)(':id/assign/:riderId'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('riderId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AdminEscalationController.prototype, "assign", null);
exports.AdminEscalationController = AdminEscalationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/orders'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        escalation_service_1.EscalationService,
        orders_service_1.OrdersService])
], AdminEscalationController);
