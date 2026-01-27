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
exports.OrdersController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const create_order_dto_1 = require("./dto/create-order.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const approval_guard_1 = require("../common/guards/approval.guard");
const rate_limit_decorator_1 = require("../common/decorators/rate-limit.decorator");
const rate_limit_guard_1 = require("../common/guards/rate-limit.guard");
const client_1 = require("@prisma/client");
const rate_rider_dto_1 = require("./dto/rate-rider.dto");
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    create(req, dto) {
        return this.ordersService.createOrder(req.user.id, dto);
    }
    uploadPrescription(req, id, url) {
        return this.ordersService.uploadPrescription(req.user.id, url, Number(id));
    }
    requestPrescription(req, orderId, dto) {
        return this.ordersService.pharmacyRequestPrescription(req.user.id, Number(orderId), dto.message);
    }
    pharmacyRespond(req, orderId, dto) {
        return this.ordersService.pharmacyRespond(req.user.id, Number(orderId), dto.action);
    }
    riderRespond(req, orderId, dto) {
        return this.ordersService.riderRespond(req.user.id, Number(orderId), dto.action, dto.reason);
    }
    riderIssue(req, orderId, dto) {
        return this.ordersService.riderReportIssue(req.user.id, Number(orderId), dto);
    }
    updateStage(req, orderId, dto) {
        if (!Object.values(client_1.OrderStatus).includes(dto.stage)) {
            throw new common_1.BadRequestException('Invalid order stage');
        }
        return this.ordersService.updateStage(req.user.id, Number(orderId), dto.stage, { lat: dto.lat, lng: dto.lng }, {
            proofUrl: dto.proofUrl,
            signatureUrl: dto.signatureUrl,
            otp: dto.otp,
        });
    }
    rateRider(req, orderId, dto) {
        return this.ordersService.rateRider(req.user.id, Number(orderId), dto);
    }
    list(req) {
        return this.ordersService.findByUser(req.user.id, req.user.role);
    }
    getTimeline(req, orderId) {
        return this.ordersService.getTimelineForUser(Number(req.user?.id), String(req.user?.role || ''), Number(orderId));
    }
    confirmChanges(req, orderId) {
        return this.ordersService.customerConfirmChanges(req.user.id, Number(orderId));
    }
    rejectChanges(req, orderId, body) {
        return this.ordersService.customerRejectChanges(req.user.id, Number(orderId), body?.reason);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('CUSTOMER'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/prescription'),
    (0, roles_decorator_1.Roles)('CUSTOMER'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('url')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "uploadPrescription", null);
__decorate([
    (0, common_1.Post)(':id/request-prescription'),
    (0, roles_decorator_1.Roles)('PHARMACY'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "requestPrescription", null);
__decorate([
    (0, common_1.Post)(':id/pharmacy-response'),
    (0, roles_decorator_1.Roles)('PHARMACY'),
    (0, rate_limit_decorator_1.RateLimit)({ key: 'orders.pharmacy-response', limit: 30, windowMs: 60_000 }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "pharmacyRespond", null);
__decorate([
    (0, common_1.Post)(':id/rider-response'),
    (0, roles_decorator_1.Roles)('RIDER'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "riderRespond", null);
__decorate([
    (0, common_1.Post)(':id/rider-issue'),
    (0, roles_decorator_1.Roles)('RIDER'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "riderIssue", null);
__decorate([
    (0, common_1.Patch)(':id/stage'),
    (0, roles_decorator_1.Roles)('RIDER'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "updateStage", null);
__decorate([
    (0, common_1.Post)(':id/rate-rider'),
    (0, roles_decorator_1.Roles)('CUSTOMER'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rate_rider_dto_1.RateRiderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "rateRider", null);
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/timeline'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getTimeline", null);
__decorate([
    (0, common_1.Post)(':id/confirm-changes'),
    (0, roles_decorator_1.Roles)('CUSTOMER'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "confirmChanges", null);
__decorate([
    (0, common_1.Post)(':id/reject-changes'),
    (0, roles_decorator_1.Roles)('CUSTOMER'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "rejectChanges", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, approval_guard_1.ApprovalGuard, rate_limit_guard_1.RateLimitGuard),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
