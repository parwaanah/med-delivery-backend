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
    async addToCart(userId, medicineId, quantity) {
        if (!medicineId || quantity < 1) {
            throw new common_1.BadRequestException('Invalid cart item.');
        }
        let cart = await this.prisma.cart.findFirst({
            where: { userId: String(userId) },
        });
        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId: String(userId) },
            });
        }
        const productId = String(medicineId);
        const existing = await this.prisma.cartItem.findFirst({
            where: { cartId: cart.id, productId },
        });
        if (existing) {
            return this.prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + quantity },
            });
        }
        return this.prisma.cartItem.create({
            data: {
                cartId: cart.id,
                productId,
                quantity,
                price: 0,
            },
        });
    }
    async getCart(userId) {
        const cart = await this.prisma.cart.findFirst({
            where: { userId: String(userId) },
            include: { items: true },
        });
        if (!cart)
            return { items: [] };
        const enriched = await Promise.all(cart.items.map(async (item) => {
            const med = await this.prisma.medicine.findUnique({
                where: { id: Number(item.productId) },
            });
            const inv = await this.prisma.pharmacyInventory.findFirst({
                where: { medicineId: med?.id },
                include: { pharmacy: { select: { id: true, name: true } } },
                orderBy: { sellingPrice: 'asc' },
            });
            return {
                ...item,
                medicine: med ?? null,
                price: item.price ? Number(item.price) : inv ? Number(inv.sellingPrice) : 0,
                stock: inv?.stock ?? 0,
                pharmacy: inv?.pharmacy?.name ?? null,
                pharmacyId: inv?.pharmacy?.id ?? null,
            };
        }));
        return { ...cart, items: enriched };
    }
    async removeItem(userId, cartItemId) {
        const cart = await this.prisma.cart.findFirst({
            where: { userId: String(userId) },
        });
        if (!cart)
            throw new common_1.BadRequestException('Cart not found');
        const item = await this.prisma.cartItem.findUnique({
            where: { id: String(cartItemId) },
        });
        if (!item || item.cartId !== cart.id) {
            throw new common_1.BadRequestException('Invalid cart item');
        }
        return this.prisma.cartItem.delete({
            where: { id: String(cartItemId) },
        });
    }
    async updateQuantity(userId, cartItemId, quantity) {
        if (quantity < 1)
            throw new common_1.BadRequestException('Quantity must be at least 1');
        const cart = await this.prisma.cart.findFirst({
            where: { userId: String(userId) },
        });
        if (!cart)
            throw new common_1.BadRequestException('Cart not found');
        const item = await this.prisma.cartItem.findUnique({
            where: { id: String(cartItemId) },
        });
        if (!item || item.cartId !== cart.id) {
            throw new common_1.BadRequestException('Invalid cart item');
        }
        return this.prisma.cartItem.update({
            where: { id: String(cartItemId) },
            data: { quantity },
        });
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
