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
exports.CartService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const surge_service_1 = require("../surge/surge.service");
const payments_service_1 = require("../payments/payments.service");
const orders_service_1 = require("../orders/orders.service");
let CartService = class CartService {
    constructor(prisma, surge, payments, orders) {
        this.prisma = prisma;
        this.surge = surge;
        this.payments = payments;
        this.orders = orders;
    }
    async calculateTotal(userId, items) {
        if (!items?.length)
            throw new common_1.BadRequestException('No items provided.');
        const baseTotal = items.reduce((t, i) => t + i.price * i.quantity, 0);
        const { multiplier: surgeMultiplier } = await this.surge.getStatus();
        const total = Number((baseTotal * surgeMultiplier).toFixed(2));
        return {
            baseTotal,
            surgeMultiplier,
            total,
            message: surgeMultiplier > 1 ? 'Surge pricing active' : 'Normal pricing',
        };
    }
    async checkout(userId, dtoItems, opts) {
        if (!dtoItems?.length)
            throw new common_1.BadRequestException('No items provided.');
        const createDto = {
            items: dtoItems,
            pharmacyId: opts?.pharmacyId,
            pickupLat: opts?.pickupLat,
            pickupLon: opts?.pickupLon,
        };
        const result = await this.orders.createOrder(userId, createDto);
        const order = result.order ?? result;
        const paymentIntent = await this.payments.createPaymentForOrder(order.id);
        return {
            orderId: order.id,
            order,
            paymentIntent,
            message: 'Order created. Complete payment to proceed.',
        };
    }
};
exports.CartService = CartService;
exports.CartService = CartService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        surge_service_1.SurgeService,
        payments_service_1.PaymentsService,
        orders_service_1.OrdersService])
], CartService);
