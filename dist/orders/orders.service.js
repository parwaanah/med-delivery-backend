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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const bullmq_1 = require("bullmq");
const ws_gateway_1 = require("../ws/ws.gateway");
const config_1 = require("@nestjs/config");
const surge_service_1 = require("../surge/surge.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma, notify, ws, config, surge, geoSurge, orderAssignQueue) {
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.config = config;
        this.surge = surge;
        this.geoSurge = geoSurge;
        this.orderAssignQueue = orderAssignQueue;
        this.logger = new common_1.Logger(OrdersService_1.name);
    }
    async createOrder(customerId, dto) {
        if (!customerId || isNaN(Number(customerId)))
            throw new common_1.BadRequestException('Invalid or missing customer ID.');
        if (!dto.items?.length)
            throw new common_1.BadRequestException('No items provided.');
        const total = dto.items.reduce((s, it) => s + it.price * it.quantity, 0);
        try {
            await this.surge.incrementDemand(1);
        }
        catch (err) {
            this.logger.warn('⚠️ Surge demand update failed:', err);
        }
        try {
            if (dto.pickupLat && dto.pickupLon) {
                await this.geoSurge.addPoint(`order:${Date.now()}`, dto.pickupLon, dto.pickupLat);
            }
        }
        catch (err) {
            this.logger.warn('⚠️ GeoSurge update failed:', err);
        }
        if (dto.pharmacyId) {
            const pharmacy = await this.prisma.user.findUnique({
                where: { id: dto.pharmacyId },
            });
            if (!pharmacy || pharmacy.role !== 'PHARMACY')
                throw new common_1.NotFoundException('Pharmacy not found.');
            const order = await this.prisma.order.create({
                data: {
                    customer: { connect: { id: Number(customerId) } },
                    pharmacy: { connect: { id: dto.pharmacyId } },
                    totalPrice: total,
                    status: 'PENDING',
                    items: {
                        create: dto.items.map((it) => ({
                            medicineId: it.medicineId ?? undefined,
                            name: it.name,
                            quantity: it.quantity,
                            price: it.price,
                        })),
                    },
                },
                include: { items: true },
            });
            await this.notify.create(dto.pharmacyId, 'ORDER_PLACED', `New order #${order.id}`, { orderId: order.id }, customerId);
            this.ws.notifyUser(dto.pharmacyId, 'order_placed', order);
            this.notify.sendAdminToast?.({
                type: 'info',
                title: 'New Order',
                text: `Order #${order.id} placed for ${pharmacy.email}`,
            });
            return order;
        }
        const medicineIds = dto.items
            .map((i) => i.medicineId)
            .filter((id) => typeof id === 'number' && !isNaN(id));
        if (!medicineIds.length)
            throw new common_1.BadRequestException('No valid medicine IDs.');
        const candidates = await this.prisma.pharmacyInventory.groupBy({
            by: ['pharmacyId'],
            where: {
                medicineId: { in: medicineIds },
                stock: { gt: 0 },
            },
            _count: { medicineId: true },
        });
        const pharmacyIds = candidates
            .filter((c) => c._count?.medicineId === medicineIds.length)
            .map((c) => c.pharmacyId);
        if (!pharmacyIds.length)
            throw new common_1.NotFoundException('No pharmacies with stock.');
        const order = await this.prisma.order.create({
            data: {
                customer: { connect: { id: Number(customerId) } },
                pharmacy: { connect: { id: pharmacyIds[0] } },
                totalPrice: total,
                status: 'PENDING',
                items: {
                    create: dto.items.map((it) => ({
                        medicineId: it.medicineId ?? undefined,
                        name: it.name,
                        quantity: it.quantity,
                        price: it.price,
                    })),
                },
            },
            include: { items: true },
        });
        for (const pid of pharmacyIds) {
            await this.prisma.orderOffer.create({
                data: { orderId: order.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
            });
            await this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${order.id} available to accept.`, { orderId: order.id }, customerId);
            this.ws.notifyUser(pid, 'order_available', { orderId: order.id });
        }
        this.notify.sendAdminToast?.({
            type: 'ok',
            title: 'Order Broadcasted',
            text: `Order #${order.id} offered to ${pharmacyIds.length} pharmacies.`,
        });
        return { order, candidates: pharmacyIds };
    }
    async updateStage(riderId, orderId, stage, location) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (order.riderId !== riderId)
            throw new common_1.BadRequestException('Not assigned to this rider.');
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status: stage },
        });
        if (stage === 'DELIVERED') {
            await this.prisma.user.update({
                where: { id: riderId },
                data: { status: 'AVAILABLE' },
            });
            await this.surge.recordRiderAvailability(riderId, true);
            try {
                await this.geoSurge.removePoint(`order:${orderId}`);
            }
            catch { }
            await this.notify.create(order.customerId, 'ORDER_DELIVERED', `Order #${orderId} delivered.`, { orderId }, riderId);
            this.notify.sendAdminToast?.({
                type: 'ok',
                title: 'Delivered',
                text: `Order #${orderId} completed by Rider ${riderId}.`,
            });
        }
        if (location)
            await this.prisma.user.update({
                where: { id: riderId },
                data: { latitude: location.lat, longitude: location.lng },
            });
        this.ws.notifyUser(order.customerId, 'order_status_update', {
            orderId,
            stage,
            location,
        });
        return { ok: true };
    }
    async adminAssign(orderId, adminId, riderId) {
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { riderId, status: 'OUT_FOR_DELIVERY' },
        });
        await this.prisma.user.update({
            where: { id: riderId },
            data: { status: 'BUSY' },
        });
        await this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned by admin.`, { orderId }, adminId);
        this.notify.sendAdminToast?.({
            type: 'ok',
            title: 'Manual Assign',
            text: `Admin manually assigned Rider ${riderId} for Order #${orderId}.`,
        });
        return updated;
    }
    async pharmacyRespond(pharmacyId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (action === 'REJECTED') {
            await this.prisma.orderOffer.updateMany({
                where: { orderId, pharmacyId },
                data: { status: 'REJECTED' },
            });
            return { ok: true };
        }
        return this.prisma.order.update({
            where: { id: orderId },
            data: { pharmacyId, status: 'ACCEPTED' },
        });
    }
    async riderRespond(riderId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (action === 'ACCEPTED') {
            await this.surge.recordRiderAvailability(riderId, false);
            return this.prisma.order.update({
                where: { id: orderId },
                data: { riderId, status: 'OUT_FOR_DELIVERY' },
            });
        }
        await this.prisma.orderOffer.updateMany({
            where: { orderId, riderId },
            data: { status: 'REJECTED' },
        });
        return { ok: true };
    }
    async findByUser(userId, role) {
        if (role === 'ADMIN')
            return this.prisma.order.findMany({ include: { items: true } });
        if (role === 'PHARMACY')
            return this.prisma.order.findMany({
                where: { pharmacyId: userId },
                include: { items: true },
            });
        if (role === 'RIDER')
            return this.prisma.order.findMany({
                where: { riderId: userId },
                include: { items: true },
            });
        return this.prisma.order.findMany({
            where: { customerId: userId },
            include: { items: true },
        });
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Inject)('ORDER_ASSIGN_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway,
        config_1.ConfigService,
        surge_service_1.SurgeService,
        geo_surge_service_1.GeoSurgeService,
        bullmq_1.Queue])
], OrdersService);
