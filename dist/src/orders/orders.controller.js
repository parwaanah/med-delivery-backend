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
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
let OrdersController = class OrdersController {
    ordersService;
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    async getAllOrders() {
        return this.ordersService.getOrders();
    }
    async createOrder(req, body) {
        const userId = req.user?.sub;
        const { pharmacyId = null, items, customerLat, customerLng } = body;
        if (!userId)
            throw new common_1.BadRequestException('User not authenticated');
        if (!Array.isArray(items) || items.length === 0)
            throw new common_1.BadRequestException('At least one valid item is required');
        return this.ordersService.createOrder(userId, pharmacyId, items, customerLat, customerLng);
    }
    async pharmacyRespond(id, body) {
        const orderId = Number(id);
        const { pharmacyId, decision } = body;
        if (!orderId || !pharmacyId)
            throw new common_1.BadRequestException('Order ID and Pharmacy ID are required');
        if (!['accept', 'reject'].includes(decision))
            throw new common_1.BadRequestException('Decision must be accept or reject');
        return this.ordersService.pharmacyRespond(orderId, pharmacyId, decision);
    }
    async riderRespond(id, body) {
        const orderId = Number(id);
        const { riderId, decision } = body;
        if (!orderId || !riderId)
            throw new common_1.BadRequestException('Order ID and Rider ID are required');
        if (!['accept', 'reject'].includes(decision))
            throw new common_1.BadRequestException('Decision must be accept or reject');
        return this.ordersService.riderRespond(orderId, riderId, decision);
    }
    async assignRider(id, body) {
        const orderId = Number(id);
        const { riderId } = body;
        if (!orderId || !riderId)
            throw new common_1.BadRequestException('Order ID and Rider ID are required');
        const updated = await this.ordersService.assignRider(orderId, riderId);
        if (!updated)
            throw new common_1.NotFoundException('Order not found');
        return updated;
    }
    async updateOrderStatus(id, body) {
        const orderId = Number(id);
        const { status } = body;
        if (!orderId)
            throw new common_1.BadRequestException('Invalid order ID');
        if (!status)
            throw new common_1.BadRequestException('Status is required');
        const updated = await this.ordersService.updateOrderStatus(orderId, status);
        if (!updated)
            throw new common_1.NotFoundException('Order not found');
        return updated;
    }
    async getOrdersByRider(id) {
        const riderId = Number(id);
        if (!riderId)
            throw new common_1.BadRequestException('Invalid rider ID');
        const orders = await this.ordersService.getOrdersByRider(riderId);
        if (!orders || orders.length === 0)
            throw new common_1.NotFoundException('No orders found for this rider');
        return orders;
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getAllOrders", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('customer'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Patch)(':id/pharmacy-response'),
    (0, roles_decorator_1.Roles)('pharmacy'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "pharmacyRespond", null);
__decorate([
    (0, common_1.Patch)(':id/rider-response'),
    (0, roles_decorator_1.Roles)('rider'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "riderRespond", null);
__decorate([
    (0, common_1.Patch)(':id/assign'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "assignRider", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)('admin', 'rider'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "updateOrderStatus", null);
__decorate([
    (0, common_1.Get)('rider/:id'),
    (0, roles_decorator_1.Roles)('rider'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OrdersController.prototype, "getOrdersByRider", null);
exports.OrdersController = OrdersController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [orders_service_1.OrdersService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map