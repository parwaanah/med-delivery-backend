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
const orders_service_1 = require("../orders/orders.service");
let CartService = class CartService {
    constructor(prisma, orders) {
        this.prisma = prisma;
        this.orders = orders;
    }
    async addToCart(userId, medicineId, quantity) {
        if (!medicineId || quantity < 1) {
            throw new common_1.BadRequestException('Invalid cart item');
        }
        const inventory = await this.prisma.pharmacyInventory.findFirst({
            where: { medicineId, stock: { gt: 0 }, deletedAt: null },
            orderBy: { sellingPrice: 'asc' },
        });
        if (!inventory) {
            throw new common_1.BadRequestException('Medicine out of stock');
        }
        const productId = String(medicineId);
        let cart = await this.prisma.cart.findFirst({
            where: { userId },
            include: { items: true },
        });
        if (!cart) {
            cart = await this.prisma.cart.create({
                data: { userId },
                include: { items: true },
            });
        }
        if (cart.items.length > 0) {
            const firstMedicineId = Number(cart.items[0].productId);
            const existingInventory = await this.prisma.pharmacyInventory.findFirst({
                where: { medicineId: firstMedicineId, deletedAt: null },
            });
            if (existingInventory &&
                existingInventory.pharmacyId !== inventory.pharmacyId) {
                throw new common_1.BadRequestException('Cart can contain medicines from only one pharmacy');
            }
        }
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
                price: inventory.sellingPrice,
            },
        });
    }
    async getCart(userId) {
        const cart = await this.prisma.cart.findFirst({
            where: { userId },
            include: { items: true },
        });
        if (!cart) {
            return { items: [] };
        }
        const items = await Promise.all(cart.items.map(async (item) => {
            const medicineId = Number(item.productId);
            const medicine = await this.prisma.medicine.findUnique({
                where: { id: medicineId },
            });
            const inventory = await this.prisma.pharmacyInventory.findFirst({
                where: { medicineId, deletedAt: null },
                include: { pharmacy: { select: { id: true, name: true } } },
            });
            return {
                id: item.id,
                quantity: item.quantity,
                price: Number(item.price),
                medicine,
                stock: inventory?.stock ?? 0,
                pharmacy: inventory?.pharmacy?.name ?? null,
                pharmacyId: inventory?.pharmacy?.id ?? null,
            };
        }));
        return { id: cart.id, items };
    }
    async removeItem(userId, cartItemId) {
        const cart = await this.prisma.cart.findFirst({ where: { userId } });
        if (!cart)
            throw new common_1.BadRequestException('Cart not found');
        const item = await this.prisma.cartItem.findUnique({
            where: { id: cartItemId },
        });
        if (!item || item.cartId !== cart.id) {
            throw new common_1.BadRequestException('Invalid cart item');
        }
        return this.prisma.cartItem.delete({ where: { id: cartItemId } });
    }
    async updateQuantity(userId, cartItemId, quantity) {
        if (quantity < 1) {
            return this.removeItem(userId, cartItemId);
        }
        const cart = await this.prisma.cart.findFirst({ where: { userId } });
        if (!cart)
            throw new common_1.BadRequestException('Cart not found');
        const item = await this.prisma.cartItem.findUnique({
            where: { id: cartItemId },
        });
        if (!item || item.cartId !== cart.id) {
            throw new common_1.BadRequestException('Invalid cart item');
        }
        return this.prisma.cartItem.update({
            where: { id: cartItemId },
            data: { quantity },
        });
    }
    async checkout(userId, body) {
        const cart = await this.prisma.cart.findFirst({
            where: { userId },
            include: { items: true },
        });
        if (!cart || cart.items.length === 0) {
            throw new common_1.BadRequestException('Cart is empty');
        }
        const customerId = Number(userId);
        if (Number.isNaN(customerId)) {
            throw new common_1.BadRequestException('Invalid customer');
        }
        const items = await Promise.all(cart.items.map(async (item) => {
            const medicineId = Number(item.productId);
            const medicine = await this.prisma.medicine.findUnique({
                where: { id: medicineId },
            });
            if (!medicine) {
                throw new common_1.BadRequestException('Invalid medicine in cart');
            }
            return {
                medicineId,
                name: medicine.name,
                quantity: item.quantity,
                price: Number(item.price),
                category: medicine.category,
            };
        }));
        const dto = {
            items,
            address: 'Cart checkout',
            notes: body?.notes,
        };
        const order = await this.orders.createOrder(customerId, dto);
        await this.prisma.cartItem.deleteMany({
            where: { cartId: cart.id },
        });
        return order;
    }
};
exports.CartService = CartService;
exports.CartService = CartService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        orders_service_1.OrdersService])
], CartService);
