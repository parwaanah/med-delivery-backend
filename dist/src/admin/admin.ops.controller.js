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
exports.AdminOpsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const orders_service_1 = require("../orders/orders.service");
const payments_service_1 = require("../payments/payments.service");
const audit_service_1 = require("../utils/audit.service");
let AdminOpsController = class AdminOpsController {
    constructor(prisma, orders, payments, audit) {
        this.prisma = prisma;
        this.orders = orders;
        this.payments = payments;
        this.audit = audit;
    }
    clampInt(v, def, min, max) {
        const n = Number(v);
        if (!Number.isFinite(n))
            return def;
        return Math.min(max, Math.max(min, Math.floor(n)));
    }
    stageStart(order) {
        const status = String(order?.status || '').toUpperCase();
        if (status === 'ASSIGNED')
            return order.riderAssignedAt ?? order.createdAt;
        if (status === 'REACHED_PHARMACY')
            return order.reachedPharmacyAt ?? order.riderAssignedAt ?? order.createdAt;
        if (status === 'PICKED_UP')
            return order.pickedUpAt ?? order.reachedPharmacyAt ?? order.createdAt;
        if (status === 'OUT_FOR_DELIVERY')
            return order.outForDeliveryAt ?? order.pickedUpAt ?? order.createdAt;
        return order.createdAt;
    }
    slaFor(order) {
        const status = String(order?.status || '').toUpperCase();
        const startedAt = this.stageStart(order) ?? new Date(order.createdAt);
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
        }
        else if (status === 'ASSIGNED') {
            threshold = riderReachSla;
            label = 'Rider reach pharmacy SLA';
        }
        else if (status === 'REACHED_PHARMACY') {
            threshold = pickupSla;
            label = 'Handover SLA';
        }
        else if (status === 'OUT_FOR_DELIVERY') {
            threshold = deliverySla;
            label = 'Delivery SLA';
        }
        else {
            return { severity: 'OK', label, thresholdMinutes: 0, ageMinutes: ageMin };
        }
        const severity = ageMin >= threshold ? 'BREACH' : ageMin >= Math.max(1, Math.floor(threshold * 0.75)) ? 'WARN' : 'OK';
        return { severity, label, thresholdMinutes: threshold, ageMinutes: ageMin };
    }
    async liveOrders(takeRaw, onlyBreachedRaw) {
        const take = this.clampInt(takeRaw, 50, 1, 200);
        const onlyBreached = String(onlyBreachedRaw || '').toLowerCase() === 'true';
        const orders = await this.prisma.order.findMany({
            where: {
                deletedAt: null,
                status: {
                    notIn: [client_1.OrderStatus.DELIVERED, client_1.OrderStatus.CANCELED, client_1.OrderStatus.REJECTED],
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
        });
        const txs = await this.prisma.transaction.findMany({
            where: { orderId: { in: orders.map((o) => o.id) } },
            orderBy: { createdAt: 'desc' },
            take: 2000,
        });
        const refundedSet = new Set();
        for (const t of txs) {
            const oid = t.orderId != null ? Number(t.orderId) : NaN;
            if (!Number.isFinite(oid))
                continue;
            if (String(t.status || '').toUpperCase() === 'REFUNDED')
                refundedSet.add(oid);
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
    async reassign(id, riderId, body, req) {
        const orderId = Number(id);
        const rid = Number(riderId);
        if (!Number.isFinite(orderId) || !Number.isFinite(rid)) {
            throw new common_1.BadRequestException('Invalid ids');
        }
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.BadRequestException('Order not found');
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
    async completeDelivery(id, body, req) {
        const orderId = Number(id);
        if (!Number.isFinite(orderId))
            throw new common_1.BadRequestException('Invalid order id');
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
    async emergencyRefund(id, body, req) {
        const orderId = Number(id);
        if (!Number.isFinite(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const tx = await this.prisma.transaction.findFirst({
            where: { orderId, status: 'SUCCESS' },
            orderBy: { createdAt: 'desc' },
        });
        if (!tx)
            throw new common_1.BadRequestException('No SUCCESS transaction found for this order');
        const res = await this.payments.refundTransaction(tx.id, body?.amount, Number(req.user.id));
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_EMERGENCY_REFUND',
            resource: `order:${orderId}`,
            meta: { transactionId: tx.id, amount: body?.amount, note: body?.note },
        });
        return res;
    }
    async escalateSla(id, body, req) {
        const orderId = Number(id);
        if (!Number.isFinite(orderId))
            throw new common_1.BadRequestException('Invalid order id');
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
};
exports.AdminOpsController = AdminOpsController;
__decorate([
    (0, common_1.Get)('live-orders'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('take')),
    __param(1, (0, common_1.Query)('onlyBreached')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminOpsController.prototype, "liveOrders", null);
__decorate([
    (0, common_1.Post)('orders/:id/reassign/:riderId'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('riderId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOpsController.prototype, "reassign", null);
__decorate([
    (0, common_1.Post)('orders/:id/complete-delivery'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOpsController.prototype, "completeDelivery", null);
__decorate([
    (0, common_1.Post)('orders/:id/emergency-refund'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOpsController.prototype, "emergencyRefund", null);
__decorate([
    (0, common_1.Post)('orders/:id/escalate-sla'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOpsController.prototype, "escalateSla", null);
exports.AdminOpsController = AdminOpsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/ops'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_service_1.OrdersService,
        payments_service_1.PaymentsService,
        audit_service_1.AuditService])
], AdminOpsController);
