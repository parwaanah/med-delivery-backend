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
const payments_service_1 = require("../payment/payments.service");
let CartService = class CartService {
    constructor(prisma, surge, payments) {
        this.prisma = prisma;
        this.surge = surge;
        this.payments = payments;
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
    async checkout(userId, items) {
        const total = await this.calculateTotal(userId, items);
        const intent = await this.payments.createPaymentIntent(total.total, userId);
        return {
            ...total,
            paymentIntent: intent,
        };
    }
};
exports.CartService = CartService;
exports.CartService = CartService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        surge_service_1.SurgeService,
        payments_service_1.PaymentsService])
], CartService);
