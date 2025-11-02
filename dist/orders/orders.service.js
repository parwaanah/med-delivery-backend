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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const bullmq_1 = require("bullmq");
const ws_gateway_1 = require("../ws/ws.gateway");
const config_1 = require("@nestjs/config");
let OrdersService = class OrdersService {
    constructor(prisma, notify, ws, config, orderAssignQueue) {
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.config = config;
        this.orderAssignQueue = orderAssignQueue;
    }
    async createOrder(customerId, dto) {
        if (!dto.items || dto.items.length === 0)
            throw new common_1.BadRequestException('No items provided');
        const total = dto.items.reduce((s, it) => s + (it.price * it.quantity), 0);
        if (dto.pharmacyId) {
            const p = await this.prisma.user.findUnique({ where: { id: dto.pharmacyId } });
            if (!p || p.role !== 'PHARMACY')
                throw new common_1.NotFoundException('Pharmacy not found');
            const order = await this.prisma.order.create({
                data: {
                    customerId,
                    pharmacyId: dto.pharmacyId,
                    totalPrice: total,
                    status: 'PENDING',
                    items: { create: dto.items.map(it => ({ medicineId: it.medicineId ?? undefined, name: it.name, quantity: it.quantity, price: it.price })) }
                },
                include: { items: true }
            });
            await this.notify.create(dto.pharmacyId, 'ORDER_PLACED', `New order #${order.id}`, { orderId: order.id }, customerId);
            this.ws.notifyUser(dto.pharmacyId, 'order_placed', order);
            return order;
        }
        const medicineIds = dto.items.map(i => i.medicineId).filter(Boolean);
        if (medicineIds.length === 0)
            throw new common_1.BadRequestException('No searchable medicines provided');
        const candidates = await this.prisma.pharmacyInventory.groupBy({
            by: ['pharmacyId'],
            where: { medicineId: { in: medicineIds }, stock: { gt: 0 } },
            _count: { medicineId: true },
        });
        const pharmacyIds = candidates.filter(c => c._count.medicineId === medicineIds.length).map(c => c.pharmacyId);
        if (pharmacyIds.length === 0)
            throw new common_1.NotFoundException('No pharmacies with full stock found nearby');
        const order = await this.prisma.order.create({
            data: {
                customerId,
                pharmacyId: pharmacyIds[0],
                totalPrice: total,
                status: 'PENDING',
                items: { create: dto.items.map(it => ({ medicineId: it.medicineId ?? undefined, name: it.name, quantity: it.quantity, price: it.price })) }
            },
        });
        for (const pid of pharmacyIds) {
            await this.prisma.orderOffer.create({
                data: { orderId: order.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
            });
            await this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${order.id} available to accept`, { orderId: order.id }, customerId);
            this.ws.notifyUser(pid, 'order_available', { orderId: order.id });
        }
        return { order, candidates: pharmacyIds };
    }
    async pharmacyRespond(pharmacyId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.status !== 'PENDING')
            throw new common_1.BadRequestException('Order not pending');
        await this.prisma.orderOffer.updateMany({
            where: { orderId, pharmacyId },
            data: { status: action }
        });
        if (action === 'REJECTED') {
            await this.notify.create(order.customerId, 'ORDER_REJECTED_BY_PHARMACY', `Order #${orderId} rejected by pharmacy ${pharmacyId}`, { orderId }, pharmacyId);
            return { ok: true };
        }
        await this.prisma.order.update({ where: { id: orderId }, data: { status: 'ACCEPTED', pharmacyId } });
        await this.notify.create(order.customerId, 'ORDER_ACCEPTED_BY_PHARMACY', `Order #${orderId} accepted`, { orderId }, pharmacyId);
        const riders = await this.prisma.user.findMany({ where: { role: 'RIDER', status: 'AVAILABLE' }, take: 10 });
        if (!riders.length) {
            await this.orderAssignQueue.add('check_assignment', { orderId }, { delay: 1000 * 60 * 3 });
            await this.notify.create(order.customerId, 'NO_RIDERS_AVAILABLE', `No riders available for order ${orderId}`, { orderId });
            return { ok: true, assigned: false };
        }
        for (const r of riders) {
            await this.prisma.orderOffer.create({ data: { orderId, riderId: r.id, offeredTo: 'RIDER' } });
            await this.notify.create(r.id, 'ORDER_ASSIGNMENT_OFFER', `New order #${orderId} available`, { orderId });
            this.ws.notifyUser(r.id, 'order_offer', { orderId });
        }
        await this.orderAssignQueue.add('check_assignment', { orderId }, { delay: 1000 * 60 * 3 });
        return { ok: true, offeredTo: riders.map(r => r.id) };
    }
    async riderRespond(riderId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (action === 'ACCEPTED') {
            const updated = await this.prisma.order.update({
                where: { id: orderId },
                data: { riderId, status: 'OUT_FOR_DELIVERY' }
            });
            await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });
            await this.prisma.orderOffer.updateMany({ where: { orderId }, data: { status: 'EXPIRED' } });
            await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'ACCEPTED' } });
            await this.notify.create(order.customerId, 'ORDER_OUT_FOR_DELIVERY', `Rider assigned for order #${orderId}`, { orderId }, riderId);
            await this.notify.create(order.pharmacyId, 'ORDER_ASSIGNED_TO_RIDER', `Rider ${riderId} assigned for order #${orderId}`, { orderId }, riderId);
            this.ws.notifyUser(order.customerId, 'order_out_for_delivery', { orderId, riderId });
            return updated;
        }
        else {
            await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'REJECTED' } });
            return { ok: true };
        }
    }
    async updateStage(riderId, orderId, stage, location) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.riderId !== riderId)
            throw new common_1.BadRequestException('Not assigned to this rider');
        await this.prisma.order.update({ where: { id: orderId }, data: { status: stage } });
        if (stage === 'DELIVERED') {
            await this.prisma.user.update({ where: { id: riderId }, data: { status: 'AVAILABLE' } });
            await this.notify.create(order.customerId, 'ORDER_DELIVERED', `Order #${orderId} delivered`, { orderId }, riderId);
        }
        else {
            await this.notify.create(order.customerId, 'ORDER_UPDATE', `Order #${orderId} status: ${stage}`, { orderId, stage }, riderId);
        }
        if (location) {
            await this.prisma.user.update({ where: { id: riderId }, data: { latitude: location.lat, longitude: location.lng } });
        }
        this.ws.notifyUser(order.customerId, 'order_status_update', { orderId, stage, location });
        return { ok: true };
    }
    async adminAssign(orderId, adminId, riderId) {
        const updated = await this.prisma.order.update({ where: { id: orderId }, data: { riderId, status: 'OUT_FOR_DELIVERY' } });
        await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });
        await this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned by admin`, { orderId }, adminId);
        return updated;
    }
    async findByUser(userId, role) {
        if (role === 'ADMIN')
            return this.prisma.order.findMany({ include: { items: true } });
        if (role === 'PHARMACY')
            return this.prisma.order.findMany({ where: { pharmacyId: userId }, include: { items: true } });
        if (role === 'RIDER')
            return this.prisma.order.findMany({ where: { riderId: userId }, include: { items: true } });
        return this.prisma.order.findMany({ where: { customerId: userId }, include: { items: true } });
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)('ORDER_ASSIGN_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway,
        config_1.ConfigService,
        bullmq_1.Queue])
], OrdersService);
