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
const payments_service_1 = require("../payments/payments.service");
const client_1 = require("@prisma/client");
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma, notify, ws, config, surge, geoSurge, payments, orderAssignQueue) {
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.config = config;
        this.surge = surge;
        this.geoSurge = geoSurge;
        this.payments = payments;
        this.orderAssignQueue = orderAssignQueue;
        this.logger = new common_1.Logger(OrdersService_1.name);
        this.riderSpeedKmPerHr = 30;
        this.defaultRiderSearchKm = Number(this.config.get('RIDER_SEARCH_KM') || 5);
    }
    haversineKm(lat1, lon1, lat2, lon2) {
        const toRad = (v) => (v * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    estimateEtaMinutes(km) {
        if (!km || km <= 0)
            return 5;
        const hours = km / this.riderSpeedKmPerHr;
        return Math.max(2, Math.round(hours * 60));
    }
    async computePharmacyScore(pharmacyId, pickupLat, pickupLon, medicineCount = 0) {
        const scoreParts = [];
        if (medicineCount > 0) {
            try {
                const stocked = await this.prisma.pharmacyInventory.count({
                    where: { pharmacyId, stock: { gt: 0 } },
                });
                scoreParts.push(Math.min(40, (stocked / medicineCount) * 40));
            }
            catch {
                scoreParts.push(10);
            }
        }
        else {
            scoreParts.push(10);
        }
        try {
            const since = new Date(Date.now() - 30 * 60 * 1000);
            const accepted = await this.prisma.order.count({
                where: {
                    pharmacyId,
                    status: client_1.OrderStatus.ACCEPTED,
                    updatedAt: { gte: since },
                },
            });
            scoreParts.push(Math.min(15, accepted * 3));
        }
        catch {
            scoreParts.push(5);
        }
        if (pickupLat && pickupLon) {
            try {
                const p = await this.prisma.user.findUnique({
                    where: { id: pharmacyId },
                    select: { latitude: true, longitude: true },
                });
                if (p?.latitude != null && p?.longitude != null) {
                    const km = this.haversineKm(Number(p.latitude), Number(p.longitude), pickupLat, pickupLon);
                    scoreParts.push(Math.max(0, 20 - Math.min(20, km * 3)));
                }
                else {
                    scoreParts.push(5);
                }
            }
            catch {
                scoreParts.push(5);
            }
        }
        else {
            scoreParts.push(5);
        }
        try {
            const { multiplier } = await this.surge.getStatus();
            scoreParts.push(Math.max(0, Math.min(10, (multiplier - 1) * 5)));
        }
        catch {
            scoreParts.push(0);
        }
        return Math.round(Math.min(100, scoreParts.reduce((a, b) => a + b, 0)));
    }
    async computeRiderScore(riderPoint, pickupLat, pickupLon) {
        const meta = riderPoint.meta || {};
        const match = riderPoint.memberId.match(/^rider:(\d+)$/);
        const riderId = match ? Number(match[1]) : NaN;
        let score = 0;
        try {
            if (!isNaN(riderId)) {
                const r = await this.prisma.user.findUnique({
                    where: { id: riderId },
                    select: { status: true },
                });
                score += r?.status === 'AVAILABLE' ? 40 : 10;
            }
            else {
                score += 10;
            }
        }
        catch {
            score += 5;
        }
        if (typeof riderPoint.distKm === 'number') {
            const d = riderPoint.distKm;
            score += Math.max(0, 30 - Math.min(30, d * 6));
        }
        else if (pickupLat && pickupLon && meta?.lat && meta?.lon) {
            const km = this.haversineKm(parseFloat(meta.lat), parseFloat(meta.lon), pickupLat, pickupLon);
            score += Math.max(0, 30 - Math.min(30, km * 6));
        }
        else {
            score += 5;
        }
        try {
            if (!isNaN(riderId)) {
                const since = new Date(Date.now() - 30 * 60 * 1000);
                const assigned = await this.prisma.order.count({
                    where: { riderId, createdAt: { gte: since } },
                });
                score += Math.max(0, 30 - Math.min(20, assigned * 6));
            }
            else {
                score += 10;
            }
        }
        catch {
            score += 10;
        }
        return Math.round(Math.min(100, score));
    }
    async createOrder(customerId, dto) {
        if (!customerId || isNaN(+customerId))
            throw new common_1.BadRequestException('Invalid or missing customer ID.');
        if (!dto.items?.length)
            throw new common_1.BadRequestException('No items provided.');
        const total = dto.items.reduce((s, it) => s + it.price * it.quantity, 0);
        try {
            await this.surge.incrementDemand(1);
        }
        catch (err) {
            this.logger.warn('Surge increment failed', err);
        }
        const orderGeoId = `order:${Date.now()}:${Math.random()
            .toString()
            .slice(2)}`;
        try {
            if (dto.pickupLat && dto.pickupLon) {
                await this.geoSurge.addPoint(orderGeoId, dto.pickupLon, dto.pickupLat);
            }
        }
        catch (err) {
            this.logger.warn('GeoSurge addPoint failed', err);
        }
        if (dto.pharmacyId) {
            const pharmacy = await this.prisma.user.findUnique({
                where: { id: dto.pharmacyId },
            });
            if (!pharmacy || pharmacy.role !== 'PHARMACY')
                throw new common_1.NotFoundException('Pharmacy not found.');
            const order = await this.prisma.order.create({
                data: {
                    customer: { connect: { id: customerId } },
                    pharmacy: { connect: { id: dto.pharmacyId } },
                    totalPrice: total,
                    status: client_1.OrderStatus.PENDING,
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
            this.notify.create(dto.pharmacyId, 'ORDER_PLACED', `New order #${order.id}`, { orderId: order.id }, customerId);
            this.ws.notifyUser(dto.pharmacyId, 'order_placed', order);
            try {
                await this.geoSurge.removePoint(orderGeoId);
            }
            catch { }
            const delayMs = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
            await this.orderAssignQueue.add('rider_escalation', { orderId: order.id }, { delay: delayMs });
            return order;
        }
        const medicineIds = dto.items
            .map((i) => i.medicineId)
            .filter((id) => typeof id === 'number');
        if (!medicineIds.length)
            throw new common_1.BadRequestException('No valid medicine IDs.');
        const inv = await this.prisma.pharmacyInventory.groupBy({
            by: ['pharmacyId'],
            where: { medicineId: { in: medicineIds }, stock: { gt: 0 } },
            _count: { medicineId: true },
        });
        const pharmacyIds = inv
            .filter((c) => c._count.medicineId === medicineIds.length)
            .map((c) => c.pharmacyId);
        if (!pharmacyIds.length)
            throw new common_1.NotFoundException('No pharmacies with stock.');
        const scores = await Promise.all(pharmacyIds.map(async (pid) => ({
            pharmacyId: pid,
            score: await this.computePharmacyScore(pid, dto.pickupLat, dto.pickupLon, medicineIds.length),
        })));
        scores.sort((a, b) => b.score - a.score);
        const bestPharmacyId = scores[0].pharmacyId;
        const order = await this.prisma.order.create({
            data: {
                customer: { connect: { id: customerId } },
                pharmacy: { connect: { id: bestPharmacyId } },
                totalPrice: total,
                status: client_1.OrderStatus.PENDING,
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
            this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${order.id} available`, { orderId: order.id }, customerId);
            this.ws.notifyUser(pid, 'order_available', { orderId: order.id });
        }
        try {
            await this.geoSurge.removePoint(orderGeoId);
        }
        catch { }
        const delayMs = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
        await this.orderAssignQueue.add('rider_escalation', { orderId: order.id }, { delay: delayMs });
        return { order, candidates: pharmacyIds, scores };
    }
    async updateStage(riderId, orderId, stage, location) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
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
        }
        if (location) {
            await this.prisma.user.update({
                where: { id: riderId },
                data: { latitude: location.lat, longitude: location.lng },
            });
        }
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
            data: { riderId, status: client_1.OrderStatus.OUT_FOR_DELIVERY },
        });
        await this.prisma.user.update({
            where: { id: riderId },
            data: { status: 'BUSY' },
        });
        await this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned by admin.`, { orderId }, adminId);
        return updated;
    }
    async pharmacyRespond(pharmacyId, orderId, action) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (action === 'REJECTED') {
            await this.prisma.orderOffer.updateMany({
                where: { orderId, pharmacyId },
                data: { status: 'REJECTED' },
            });
            return { ok: true };
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                pharmacyId,
                status: client_1.OrderStatus.ACCEPTED,
            },
        });
        await this.prisma.orderOffer.updateMany({
            where: { orderId, pharmacyId: { not: pharmacyId } },
            data: { status: 'REJECTED' },
        });
        this.notify.create(updated.customerId, 'ORDER_ACCEPTED', `Order #${orderId} accepted. Complete payment.`, { orderId }, pharmacyId);
        try {
            const payment = await this.payments.createPaymentForOrder(orderId);
            this.ws.notifyUser(updated.customerId, 'payment_required', {
                orderId,
                payment,
            });
            return { order: updated, payment };
        }
        catch (err) {
            this.logger.error('Payment create failed:', err);
            return {
                order: updated,
                paymentError: err?.message ?? String(err),
            };
        }
    }
    async riderRespond(riderId, orderId, action) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (action === 'ACCEPTED') {
            await this.surge.recordRiderAvailability(riderId, false);
            return this.prisma.order.update({
                where: { id: orderId },
                data: { riderId, status: client_1.OrderStatus.OUT_FOR_DELIVERY },
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
    __param(7, (0, common_1.Inject)('ORDER_ASSIGN_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway,
        config_1.ConfigService,
        surge_service_1.SurgeService,
        geo_surge_service_1.GeoSurgeService,
        payments_service_1.PaymentsService,
        bullmq_1.Queue])
], OrdersService);
