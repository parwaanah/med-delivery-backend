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
const respond_offer_dto_1 = require("./dto/respond-offer.dto");
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    create(req, dto) {
        const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        return this.ordersService.createOrder(userId, dto);
    }
    findAll(req) {
        const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        const role = (req.user?.role ?? '').toUpperCase();
        return this.ordersService.findByUser(userId, role);
    }
    pharmacyRespond(req, orderId, dto) {
        const pharmacyId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        return this.ordersService.pharmacyRespond(pharmacyId, Number(orderId), dto.action);
    }
    riderRespond(req, orderId, dto) {
        const riderId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        return this.ordersService.riderRespond(riderId, Number(orderId), dto.action);
    }
    riderStage(req, orderId, body) {
        const riderId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        return this.ordersService.updateStage(riderId, Number(orderId), body.stage, body.location);
    }
    adminAssign(req, orderId, riderId) {
        const adminId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
        return this.ordersService.adminAssign(Number(orderId), adminId, Number(riderId));
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('customer'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('pharmacy/:orderId/respond'),
    (0, roles_decorator_1.Roles)('pharmacy'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, respond_offer_dto_1.RespondOfferDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "pharmacyRespond", null);
__decorate([
    (0, common_1.Post)('rider/:orderId/respond'),
    (0, roles_decorator_1.Roles)('rider'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, respond_offer_dto_1.RespondOfferDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "riderRespond", null);
__decorate([
    (0, common_1.Patch)('rider/:orderId/stage'),
    (0, roles_decorator_1.Roles)('rider'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "riderStage", null);
__decorate([
    (0, common_1.Post)('admin/:orderId/assign/:riderId'),
    (0, roles_decorator_1.Roles)('admin'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Param)('riderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "adminAssign", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
