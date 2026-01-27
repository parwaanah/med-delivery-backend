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
exports.AdminPharmaciesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const orders_service_1 = require("../orders/orders.service");
const audit_service_1 = require("../utils/audit.service");
const notification_service_1 = require("../utils/notification.service");
let AdminPharmaciesController = class AdminPharmaciesController {
    constructor(prisma, ws, orders, audit, notify) {
        this.prisma = prisma;
        this.ws = ws;
        this.orders = orders;
        this.audit = audit;
        this.notify = notify;
    }
    async inventory(id) {
        const pharmacyId = Number(id);
        if (isNaN(pharmacyId))
            throw new common_1.BadRequestException('Invalid pharmacy id');
        const pharmacy = await this.prisma.user.findUnique({
            where: { id: pharmacyId },
            select: { id: true, role: true },
        });
        if (!pharmacy || pharmacy.role !== client_1.UserRole.PHARMACY) {
            throw new common_1.BadRequestException('Pharmacy not found');
        }
        const items = await this.prisma.pharmacyInventory.findMany({
            where: { pharmacyId, deletedAt: null },
            include: {
                medicine: { select: { id: true, name: true, rxType: true, category: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        return { pharmacyId, items };
    }
    async freeze(id, body, req) {
        const pharmacyId = Number(id);
        if (isNaN(pharmacyId))
            throw new common_1.BadRequestException('Invalid pharmacy id');
        const user = await this.prisma.user.findUnique({
            where: { id: pharmacyId },
            select: { id: true, role: true, status: true },
        });
        if (!user || user.role !== client_1.UserRole.PHARMACY) {
            throw new common_1.BadRequestException('Pharmacy not found');
        }
        await this.prisma.user.update({
            where: { id: pharmacyId },
            data: { status: 'SUSPENDED' },
        });
        this.ws.notifyUser(pharmacyId, 'user.status', { status: 'SUSPENDED' });
        await this.notify.create(pharmacyId, 'ACCOUNT_SUSPENDED', 'Your pharmacy account was suspended by admin. Contact support.', { status: 'SUSPENDED', reason: body?.reason }, req.user.id);
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'PHARMACY_FREEZE',
            resource: `pharmacy:${pharmacyId}`,
            meta: { from: user.status, to: 'SUSPENDED', reason: body?.reason },
        });
        return { ok: true, status: 'SUSPENDED' };
    }
    async unfreeze(id, body, req) {
        const pharmacyId = Number(id);
        if (isNaN(pharmacyId))
            throw new common_1.BadRequestException('Invalid pharmacy id');
        const user = await this.prisma.user.findUnique({
            where: { id: pharmacyId },
            select: { id: true, role: true, status: true },
        });
        if (!user || user.role !== client_1.UserRole.PHARMACY) {
            throw new common_1.BadRequestException('Pharmacy not found');
        }
        await this.prisma.user.update({
            where: { id: pharmacyId },
            data: { status: 'APPROVED' },
        });
        this.ws.notifyUser(pharmacyId, 'user.status', { status: 'APPROVED' });
        await this.notify.create(pharmacyId, 'ACCOUNT_RESTORED', 'Your pharmacy account is active again.', { status: 'APPROVED', reason: body?.reason }, req.user.id);
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'PHARMACY_UNFREEZE',
            resource: `pharmacy:${pharmacyId}`,
            meta: { from: user.status, to: 'APPROVED', reason: body?.reason },
        });
        return { ok: true, status: 'APPROVED' };
    }
    async unassignOrders(id, req) {
        const pharmacyId = Number(id);
        if (isNaN(pharmacyId))
            throw new common_1.BadRequestException('Invalid pharmacy id');
        const pharmacy = await this.prisma.user.findUnique({
            where: { id: pharmacyId },
            select: { id: true, role: true },
        });
        if (!pharmacy || pharmacy.role !== client_1.UserRole.PHARMACY) {
            throw new common_1.BadRequestException('Pharmacy not found');
        }
        const orders = await this.prisma.order.findMany({
            where: {
                pharmacyId,
                riderId: { not: null },
                status: {
                    in: [
                        client_1.OrderStatus.ASSIGNED,
                        client_1.OrderStatus.OUT_FOR_DELIVERY,
                        client_1.OrderStatus.REACHED_PHARMACY,
                        client_1.OrderStatus.PICKED_UP,
                    ],
                },
            },
            select: { id: true },
            take: 500,
        });
        let count = 0;
        for (const o of orders) {
            await this.orders.adminUnassignRider(o.id);
            count += 1;
        }
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'PHARMACY_FORCE_UNASSIGN_ORDERS',
            resource: `pharmacy:${pharmacyId}`,
            meta: { count },
        });
        return { ok: true, count };
    }
};
exports.AdminPharmaciesController = AdminPharmaciesController;
__decorate([
    (0, common_1.Get)(':id/inventory'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminPharmaciesController.prototype, "inventory", null);
__decorate([
    (0, common_1.Patch)(':id/freeze'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminPharmaciesController.prototype, "freeze", null);
__decorate([
    (0, common_1.Patch)(':id/unfreeze'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminPharmaciesController.prototype, "unfreeze", null);
__decorate([
    (0, common_1.Post)(':id/unassign-orders'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminPharmaciesController.prototype, "unassignOrders", null);
exports.AdminPharmaciesController = AdminPharmaciesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/pharmacies'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ws_gateway_1.WsGateway,
        orders_service_1.OrdersService,
        audit_service_1.AuditService,
        notification_service_1.NotificationService])
], AdminPharmaciesController);
