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
exports.AdminOrdersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const orders_service_1 = require("../orders/orders.service");
const audit_service_1 = require("../utils/audit.service");
let AdminOrdersController = class AdminOrdersController {
    constructor(orders, audit) {
        this.orders = orders;
        this.audit = audit;
    }
    async forceCancel(id, body, req) {
        const orderId = Number(id);
        if (isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const res = await this.orders.adminForceCancel(orderId, body?.reason, req.user.id);
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_FORCE_CANCEL',
            resource: `order:${orderId}`,
            meta: { reason: body?.reason },
        });
        return res;
    }
    async forceStatus(id, body, req) {
        const orderId = Number(id);
        if (isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const res = await this.orders.adminForceStatus(orderId, body.status, body.note, req.user.id);
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_FORCE_STATUS',
            resource: `order:${orderId}`,
            meta: { to: body.status, note: body.note },
        });
        return res;
    }
    async unassignRider(id, req) {
        const orderId = Number(id);
        if (isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const res = await this.orders.adminUnassignRider(orderId, req.user.id);
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_UNASSIGN_RIDER',
            resource: `order:${orderId}`,
        });
        return res;
    }
    async addNote(id, body, req) {
        if (!body?.note?.trim())
            throw new common_1.BadRequestException('Note required');
        const orderId = Number(id);
        const res = await this.orders.adminAddNote(orderId, body.note.trim());
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_ADMIN_NOTE',
            resource: `order:${orderId}`,
            meta: { note: body.note },
        });
        return res;
    }
    async settle(id, body, req) {
        const orderId = Number(id);
        if (isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const res = await this.orders.adminSettleOrder(orderId, req.user.id, {
            note: body?.note,
            force: Boolean(body?.force),
        });
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_SETTLED',
            resource: `order:${orderId}`,
            meta: { note: body?.note, force: Boolean(body?.force) },
        });
        return res;
    }
    async unsettle(id, body, req) {
        const orderId = Number(id);
        if (isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const res = await this.orders.adminUnsettleOrder(orderId, req.user.id, {
            note: body?.note,
        });
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'ORDER_UNSETTLED',
            resource: `order:${orderId}`,
            meta: { note: body?.note },
        });
        return res;
    }
    async verifyPrescription(id, req) {
        const orderId = Number(id);
        if (isNaN(orderId))
            throw new common_1.BadRequestException('Invalid order id');
        const res = await this.orders.adminVerifyPrescription(orderId, req.user.id);
        await this.audit.logAdminAction({
            userId: req.user.id,
            action: 'PRESCRIPTION_VERIFIED',
            resource: `order:${orderId}`,
        });
        return res;
    }
};
exports.AdminOrdersController = AdminOrdersController;
__decorate([
    (0, common_1.Post)(':id/cancel'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "forceCancel", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "forceStatus", null);
__decorate([
    (0, common_1.Post)(':id/unassign'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "unassignRider", null);
__decorate([
    (0, common_1.Post)(':id/note'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "addNote", null);
__decorate([
    (0, common_1.Patch)(':id/settle'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "settle", null);
__decorate([
    (0, common_1.Patch)(':id/unsettle'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "unsettle", null);
__decorate([
    (0, common_1.Post)(':id/prescription/verify'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminOrdersController.prototype, "verifyPrescription", null);
exports.AdminOrdersController = AdminOrdersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, common_1.Controller)('admin/orders'),
    __metadata("design:paramtypes", [orders_service_1.OrdersService,
        audit_service_1.AuditService])
], AdminOrdersController);
