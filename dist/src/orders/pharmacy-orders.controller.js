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
exports.PharmacyOrdersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const approval_guard_1 = require("../common/guards/approval.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const pharmacy_accept_dto_1 = require("./dto/pharmacy-accept.dto");
const rate_limit_decorator_1 = require("../common/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../common/guards/rate-limit.guard");
let PharmacyOrdersController = class PharmacyOrdersController {
    constructor(orders) {
        this.orders = orders;
    }
    list(req, status) {
        return this.orders.listForPharmacy(req.user.id, status);
    }
    get(req, id) {
        return this.orders.getForPharmacy(req.user.id, Number(id));
    }
    accept(req, id, body) {
        if (body?.totalPrice != null &&
            !Number.isFinite(Number(body.totalPrice))) {
            throw new common_1.BadRequestException('Invalid totalPrice');
        }
        return this.orders.pharmacyAccept(req.user.id, Number(id), body);
    }
    reject(req, id, reason) {
        return this.orders.pharmacyReject(req.user.id, Number(id), reason);
    }
    requestPrescription(req, id, message) {
        return this.orders.pharmacyRequestPrescription(req.user.id, Number(id), message);
    }
    markReady(req, id) {
        return this.orders.pharmacyMarkReady(req.user.id, Number(id));
    }
    confirmHandover(req, id) {
        return this.orders.pharmacyConfirmHandover(req.user.id, Number(id));
    }
    verifyPrescription(req, id) {
        return this.orders.pharmacyVerifyPrescription(req.user.id, Number(id));
    }
};
exports.PharmacyOrdersController = PharmacyOrdersController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/accept'),
    (0, rate_limit_decorator_1.RateLimit)({ key: 'pharmacy.orders.accept', limit: 30, windowMs: 60_000 }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, pharmacy_accept_dto_1.PharmacyAcceptDto]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "accept", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, rate_limit_decorator_1.RateLimit)({ key: 'pharmacy.orders.reject', limit: 30, windowMs: 60_000 }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/request-prescription'),
    (0, rate_limit_decorator_1.RateLimit)({
        key: 'pharmacy.orders.request-prescription',
        limit: 60,
        windowMs: 60_000,
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('message')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "requestPrescription", null);
__decorate([
    (0, common_1.Post)(':id/mark-ready'),
    (0, rate_limit_decorator_1.RateLimit)({ key: 'pharmacy.orders.mark-ready', limit: 60, windowMs: 60_000 }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "markReady", null);
__decorate([
    (0, common_1.Post)(':id/confirm-handover'),
    (0, rate_limit_decorator_1.RateLimit)({
        key: 'pharmacy.orders.confirm-handover',
        limit: 60,
        windowMs: 60_000,
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "confirmHandover", null);
__decorate([
    (0, common_1.Post)(':id/prescription/verify'),
    (0, rate_limit_decorator_1.RateLimit)({
        key: 'pharmacy.orders.prescription-verify',
        limit: 60,
        windowMs: 60_000,
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PharmacyOrdersController.prototype, "verifyPrescription", null);
exports.PharmacyOrdersController = PharmacyOrdersController = __decorate([
    (0, common_1.Controller)('pharmacy/orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard, rate_limit_guard_1.RateLimitGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.PHARMACY),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], PharmacyOrdersController);
