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
        this.isLoadtest =
            String(process.env.LOADTEST_MODE || this.config.get('LOADTEST_MODE') || '')
                .trim()
                .toLowerCase() === 'true';
        if (this.isLoadtest)
            this.logger.warn('LOADTEST_MODE ACTIVE → inventory bypass + payment bypass enabled.');
    }
    isEscalatable(status) {
        return (status === client_1.OrderStatus.PENDING ||
            status === client_1.OrderStatus.ACCEPTED ||
            status === client_1.OrderStatus.ASSIGNED);
    }
    toRad(v) {
        return (v * Math.PI) / 180;
    }
    haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    async logTimeline(orderId, event, data) {
        try {
            await this.prisma.orderTimeline.create({
                data: {
                    orderId,
                    event,
                    data: data ? JSON.stringify(data) : undefined,
                },
            });
        }
        catch (e) {
            this.logger.warn('Timeline failed', e?.message ?? e);
        }
    }
    resolveModeFromItems(items) {
        let requiresPrescription = false;
        let hasStrict = false;
        let hasChronic = false;
        let hasNonRx = false;
        for (const it of items) {
            const cat = it.category;
            if (!cat) {
                hasChronic = true;
                continue;
            }
            const c = String(cat).toUpperCase();
            if (c === 'STRICT_RX' || c === 'STRICT' || c === 'HARD') {
                hasStrict = true;
                requiresPrescription = true;
            }
            else if (c === 'CHRONIC' || c === 'SOFT') {
                hasChronic = true;
            }
            else {
                hasNonRx = true;
            }
        }
        if (hasStrict)
            return {
                mode: client_1.PaymentMode.PAY_AFTER_VERIFICATION,
                requiresPrescription: true,
            };
        if (hasChronic && !hasNonRx)
            return { mode: client_1.PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
        if (hasNonRx && !hasChronic)
            return { mode: client_1.PaymentMode.PAY_FIRST, requiresPrescription: false };
        return { mode: client_1.PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
    }
    async getAnyPharmacyId() {
        const p = await this.prisma.user.findFirst({
            where: { role: client_1.UserRole.PHARMACY },
            select: { id: true },
        });
        return p?.id ?? 1;
    }
    async createOrder(customerId, dto) {
        if (!customerId)
            throw new common_1.BadRequestException('Invalid customer');
        if (!dto.items?.length)
            throw new common_1.BadRequestException('No items provided');
        const medicineIds = dto.items
            .map((i) => i.medicineId)
            .filter((v) => typeof v === 'number');
        if (!medicineIds.length)
            throw new common_1.BadRequestException('Invalid items');
        const { mode, requiresPrescription } = this.resolveModeFromItems(dto.items);
        const orderGeoId = `order:${Date.now()}:${Math.random()
            .toString()
            .slice(2)}`;
        const user = await this.prisma.user.findUnique({
            where: { id: customerId },
        });
        const pickupLat = user?.latitude != null ? Number(user.latitude) : null;
        const pickupLon = user?.longitude != null ? Number(user.longitude) : null;
        if (pickupLat != null && pickupLon != null) {
            try {
                await this.geoSurge.addPoint(orderGeoId, pickupLon, pickupLat);
            }
            catch { }
        }
        if (dto.pharmacyId) {
            if (this.isLoadtest) {
                const chosen = Number(dto.pharmacyId) || (await this.getAnyPharmacyId());
                const validPharmacy = await this.prisma.user.findUnique({
                    where: { id: chosen },
                    select: { id: true },
                });
                const pharmacyId = validPharmacy?.id ?? (await this.getAnyPharmacyId());
                let total = 0;
                const itemsCreate = dto.items.map((it) => {
                    const price = it.price ? Number(it.price) : 10;
                    total += price * (it.quantity ?? 1);
                    return {
                        medicineId: it.medicineId ?? 0,
                        name: it.name ??
                            `LT_Item_${it.medicineId ?? Math.random().toString(36)}`,
                        quantity: it.quantity ?? 1,
                        price,
                    };
                });
                const created = await this.prisma.order.create({
                    data: {
                        customerId,
                        pharmacyId,
                        totalPrice: total,
                        status: client_1.OrderStatus.PENDING,
                        paymentMode: mode,
                        requiresPrescription,
                        items: { create: itemsCreate },
                    },
                    include: { items: true },
                });
                await this.prisma.orderOffer.create({
                    data: {
                        orderId: created.id,
                        pharmacyId,
                        offeredTo: 'PHARMACY',
                    },
                });
                await this.logTimeline(created.id, 'ORDER_CREATED', {
                    loadtest: true,
                    mode,
                    requiresPrescription,
                });
                this.notify.create(pharmacyId, 'ORDER_PLACED', `Order #${created.id}`, { orderId: created.id }, customerId);
                this.ws.notifyUser(pharmacyId, 'order_placed', created);
                if (mode === client_1.PaymentMode.PAY_FIRST) {
                    try {
                        await this.geoSurge.removePoint(orderGeoId);
                    }
                    catch { }
                    return {
                        order: created,
                        payment: {
                            mock: true,
                            status: 'PAID',
                            id: `mock_${created.id}`,
                        },
                    };
                }
                const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) *
                    60 *
                    1000;
                await this.orderAssignQueue.add('rider_escalation', { orderId: created.id }, { delay });
                try {
                    await this.geoSurge.removePoint(orderGeoId);
                }
                catch { }
                return created;
            }
            const pharmacyId = Number(dto.pharmacyId);
            const inv = await this.prisma.pharmacyInventory.findMany({
                where: {
                    pharmacyId,
                    medicineId: { in: medicineIds },
                },
            });
            if (inv.length !== medicineIds.length)
                throw new common_1.NotFoundException('Some items not available at pharmacy');
            const order = await this.prisma.$transaction(async (tx) => {
                let total = 0;
                const itemsCreate = [];
                for (const it of dto.items) {
                    const row = inv.find((r) => r.medicineId === it.medicineId);
                    if (!row)
                        throw new common_1.BadRequestException('Item not stocked');
                    if (row.stock < it.quantity)
                        throw new common_1.BadRequestException(`Insufficient stock for ${it.medicineId}`);
                    const price = Number(row.sellingPrice);
                    total += price * it.quantity;
                    const med = await tx.medicine.findUnique({
                        where: { id: it.medicineId },
                    });
                    itemsCreate.push({
                        medicineId: it.medicineId,
                        name: med?.name ?? it.name ?? 'Item',
                        quantity: it.quantity,
                        price,
                    });
                }
                const created = await tx.order.create({
                    data: {
                        customerId,
                        pharmacyId,
                        totalPrice: total,
                        status: client_1.OrderStatus.PENDING,
                        paymentMode: mode,
                        requiresPrescription,
                        items: { create: itemsCreate },
                    },
                    include: { items: true },
                });
                for (const it of dto.items) {
                    await tx.pharmacyInventory.updateMany({
                        where: {
                            pharmacyId,
                            medicineId: it.medicineId,
                        },
                        data: { stock: { decrement: it.quantity } },
                    });
                }
                await tx.orderOffer.create({
                    data: {
                        orderId: created.id,
                        pharmacyId,
                        offeredTo: 'PHARMACY',
                    },
                });
                return created;
            });
            await this.logTimeline(order.id, 'ORDER_CREATED', {
                mode,
                requiresPrescription,
            });
            this.notify.create(order.pharmacyId, 'ORDER_PLACED', `Order #${order.id}`, { orderId: order.id }, customerId);
            this.ws.notifyUser(order.pharmacyId, 'order_placed', order);
            if (mode === client_1.PaymentMode.PAY_FIRST) {
                const payment = await this.payments.createPaymentForOrder(order.id);
                try {
                    await this.geoSurge.removePoint(orderGeoId);
                }
                catch { }
                return { order, payment };
            }
            const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) *
                60 *
                1000;
            await this.orderAssignQueue.add('rider_escalation', { orderId: order.id }, { delay });
            try {
                await this.geoSurge.removePoint(orderGeoId);
            }
            catch { }
            return order;
        }
        if (this.isLoadtest) {
            const best = (await this.getAnyPharmacyId()) ??
                Number(this.config.get('LOADTEST_PHARMACY_ID'));
            if (!best)
                throw new common_1.NotFoundException('No pharmacy available');
            let total = 0;
            const itemsCreate = dto.items.map((it) => {
                const price = it.price ? Number(it.price) : 10;
                total += price * (it.quantity ?? 1);
                return {
                    medicineId: it.medicineId ?? 0,
                    name: it.name ??
                        `LT_Item_${it.medicineId ?? Math.random().toString(36)}`,
                    quantity: it.quantity ?? 1,
                    price,
                };
            });
            const created = await this.prisma.$transaction(async (tx) => {
                const ord = await tx.order.create({
                    data: {
                        customerId,
                        pharmacyId: best,
                        totalPrice: total,
                        status: client_1.OrderStatus.PENDING,
                        paymentMode: mode,
                        requiresPrescription,
                        items: { create: itemsCreate },
                    },
                    include: { items: true },
                });
                await tx.orderOffer.create({
                    data: {
                        orderId: ord.id,
                        pharmacyId: best,
                        offeredTo: 'PHARMACY',
                    },
                });
                return ord;
            });
            await this.logTimeline(created.id, 'ORDER_CREATED', {
                loadtest: true,
                bestPharmacyId: best,
                mode,
                requiresPrescription,
            });
            this.notify.create(best, 'ORDER_AVAILABLE', `Order #${created.id}`, { orderId: created.id }, customerId);
            this.ws.notifyUser(best, 'order_available', { orderId: created.id });
            if (mode === client_1.PaymentMode.PAY_FIRST) {
                try {
                    await this.geoSurge.removePoint(orderGeoId);
                }
                catch { }
                return {
                    order: created,
                    candidates: [best],
                    scores: [{ pharmacyId: best, score: 1 }],
                    payment: {
                        mock: true,
                        status: 'PAID',
                        id: `mock_${created.id}`,
                    },
                };
            }
            const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) *
                60 *
                1000;
            await this.orderAssignQueue.add('rider_escalation', { orderId: created.id }, { delay });
            try {
                await this.geoSurge.removePoint(orderGeoId);
            }
            catch { }
            return { order: created, candidates: [best], scores: [{ pharmacyId: best, score: 1 }] };
        }
        const grouped = await this.prisma.pharmacyInventory.groupBy({
            by: ['pharmacyId'],
            where: {
                medicineId: { in: medicineIds },
                stock: { gt: 0 },
            },
            _count: { medicineId: true },
        });
        const pharmacyIds = grouped
            .filter((g) => g._count.medicineId === medicineIds.length)
            .map((g) => g.pharmacyId);
        if (!pharmacyIds.length)
            throw new common_1.NotFoundException('No pharmacy has all items in stock');
        const scores = pharmacyIds.map((pid) => ({ pharmacyId: pid, score: 1 }));
        const bestPharmacyId = scores[0].pharmacyId;
        const inv2 = await this.prisma.pharmacyInventory.findMany({
            where: { pharmacyId: bestPharmacyId, medicineId: { in: medicineIds } },
        });
        const finalOrder = await this.prisma.$transaction(async (tx) => {
            let total = 0;
            const itemsCreate = [];
            for (const it of dto.items) {
                const row = inv2.find((r) => r.medicineId === it.medicineId);
                if (!row)
                    throw new common_1.BadRequestException('Item not in stock');
                if (row.stock < it.quantity)
                    throw new common_1.BadRequestException(`Low stock for ${it.medicineId}`);
                const price = Number(row.sellingPrice);
                total += price * it.quantity;
                const med = await tx.medicine.findUnique({ where: { id: it.medicineId } });
                itemsCreate.push({ medicineId: it.medicineId, name: med?.name ?? it.name ?? 'Item', quantity: it.quantity, price });
            }
            const created = await tx.order.create({
                data: {
                    customerId,
                    pharmacyId: bestPharmacyId,
                    totalPrice: total,
                    status: client_1.OrderStatus.PENDING,
                    paymentMode: mode,
                    requiresPrescription,
                    items: { create: itemsCreate },
                },
                include: { items: true },
            });
            for (const it of dto.items) {
                await tx.pharmacyInventory.updateMany({
                    where: { pharmacyId: bestPharmacyId, medicineId: it.medicineId },
                    data: { stock: { decrement: it.quantity } },
                });
            }
            for (const pid of pharmacyIds) {
                await tx.orderOffer.create({
                    data: { orderId: created.id, pharmacyId: pid, offeredTo: 'PHARMACY' },
                });
            }
            return created;
        });
        await this.logTimeline(finalOrder.id, 'ORDER_CREATED', {
            candidates: pharmacyIds,
            bestPharmacyId,
            mode,
            requiresPrescription,
        });
        for (const pid of pharmacyIds) {
            this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${finalOrder.id}`, { orderId: finalOrder.id }, customerId);
            this.ws.notifyUser(pid, 'order_available', { orderId: finalOrder.id });
        }
        if (mode === client_1.PaymentMode.PAY_FIRST) {
            const payment = await this.payments.createPaymentForOrder(finalOrder.id);
            try {
                await this.geoSurge.removePoint(orderGeoId);
            }
            catch { }
            return { order: finalOrder, candidates: pharmacyIds, scores, payment };
        }
        const delay2 = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
        await this.orderAssignQueue.add('rider_escalation', { orderId: finalOrder.id }, { delay: delay2 });
        try {
            await this.geoSurge.removePoint(orderGeoId);
        }
        catch { }
        return { order: finalOrder, candidates: pharmacyIds, scores };
    }
    async uploadPrescription(customerId, url, attachOrderId) {
        if (!url)
            throw new common_1.BadRequestException('Invalid URL');
        const pres = await this.prisma.prescription.create({ data: { customerId, url } });
        await this.logTimeline(attachOrderId ?? 0, 'PRESCRIPTION_UPLOADED', { url, prescriptionId: pres.id });
        if (attachOrderId) {
            try {
                await this.prisma.order.update({ where: { id: attachOrderId }, data: { prescriptionId: pres.id } });
                const order = await this.prisma.order.findUnique({ where: { id: attachOrderId } });
                if (order && order.pharmacyId) {
                    this.notify.create(order.pharmacyId, 'PRESCRIPTION_UPLOADED', 'Prescription added', { orderId: order.id, prescriptionId: pres.id }, customerId);
                    this.ws.notifyUser(order.pharmacyId, 'prescription_uploaded', { orderId: order.id, prescriptionId: pres.id });
                }
            }
            catch (e) {
                this.logger.warn('Failed attaching prescription to order', e?.message ?? e);
            }
        }
        return pres;
    }
    async pharmacyRequestPrescription(pharmacyId, orderId, message) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId)
            throw new common_1.BadRequestException('Not authorized for this order');
        await this.prisma.order.update({ where: { id: orderId }, data: { requiresPrescription: true } });
        await this.logTimeline(orderId, 'PRESCRIPTION_REQUESTED_BY_PHARMACY', { pharmacyId, message });
        this.notify.create(order.customerId, 'PRESCRIPTION_REQUIRED', message || 'Pharmacy requested a prescription for your order', { orderId }, pharmacyId);
        this.ws.notifyUser(order.customerId, 'prescription_required', { orderId, message });
        return { ok: true };
    }
    async pharmacyRespond(pharmacyId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, prescription: true } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (action === 'REJECTED') {
            await this.prisma.orderOffer.updateMany({ where: { orderId, pharmacyId }, data: { status: 'REJECTED' } });
            await this.logTimeline(orderId, 'PHARMACY_REJECTED', { pharmacyId });
            return { ok: true };
        }
        const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: client_1.OrderStatus.ACCEPTED, pharmacyId }, include: { items: true } });
        await this.prisma.orderOffer.updateMany({ where: { orderId, pharmacyId: { not: pharmacyId } }, data: { status: 'REJECTED' } });
        await this.logTimeline(orderId, 'PHARMACY_ACCEPTED', { pharmacyId });
        if (updated.paymentMode === client_1.PaymentMode.PAY_AFTER_ACCEPT || updated.paymentMode === client_1.PaymentMode.PAY_AFTER_VERIFICATION) {
            if (this.isLoadtest) {
                this.ws.notifyUser(updated.customerId, 'payment_required', { orderId, payment: { mock: true, status: 'PAID', id: `mock_${orderId}` } });
                return { order: updated, payment: { mock: true, status: 'PAID' } };
            }
            const payment = await this.payments.createPaymentForOrder(orderId);
            this.ws.notifyUser(updated.customerId, 'payment_required', { orderId, payment });
            return { order: updated, payment };
        }
        const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60000;
        await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
        return { order: updated };
    }
    async riderRespond(riderId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (action === 'ACCEPTED') {
            await this.prisma.user.update({ where: { id: riderId }, data: { status: 'BUSY' } });
            const updated = await this.prisma.order.update({ where: { id: orderId }, data: { riderId, status: client_1.OrderStatus.OUT_FOR_DELIVERY } });
            await this.logTimeline(orderId, 'RIDER_ACCEPTED', { riderId });
            return updated;
        }
        await this.prisma.orderOffer.updateMany({ where: { orderId, riderId }, data: { status: 'REJECTED' } });
        await this.logTimeline(orderId, 'RIDER_REJECTED', { riderId });
        const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
        await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
        return { ok: true };
    }
    async adminAssign(orderId, adminId, riderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!this.isEscalatable(order.status)) {
            throw new common_1.BadRequestException(`Order cannot be assigned in status ${order.status}`);
        }
        const rider = await this.prisma.user.findUnique({
            where: { id: riderId },
        });
        if (!rider || rider.role !== client_1.UserRole.RIDER) {
            throw new common_1.BadRequestException('Invalid rider');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: riderId },
                data: { status: 'BUSY' },
            });
            return tx.order.update({
                where: { id: orderId },
                data: {
                    riderId,
                    status: client_1.OrderStatus.OUT_FOR_DELIVERY,
                },
            });
        });
        await this.logTimeline(orderId, 'ASSIGNED_BY_ADMIN', {
            adminId,
            riderId,
        });
        this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned`, { orderId }, adminId);
        this.ws.notifyUser(updated.customerId, 'order_status_update', {
            orderId,
            stage: client_1.OrderStatus.OUT_FOR_DELIVERY,
        });
        return updated;
    }
    async updateStage(riderId, orderId, stage, location) {
        if (!Object.values(client_1.OrderStatus).includes(stage)) {
            throw new common_1.BadRequestException('Invalid order stage');
        }
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.riderId !== riderId)
            throw new common_1.BadRequestException('Not your order');
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status: stage },
        });
        if (stage === client_1.OrderStatus.DELIVERED) {
            await this.prisma.user.update({
                where: { id: riderId },
                data: { status: 'AVAILABLE' },
            });
            await this.logTimeline(orderId, 'DELIVERED', {
                riderId,
            });
            try {
                await this.geoSurge.removePoint(`order:${orderId}`);
            }
            catch { }
            this.notify.create(order.customerId, 'ORDER_DELIVERED', `Order #${orderId} delivered.`, { orderId }, riderId);
        }
        if (location?.lat != null && location?.lng != null) {
            await this.prisma.user.update({
                where: { id: riderId },
                data: {
                    latitude: location.lat,
                    longitude: location.lng,
                },
            });
        }
        this.ws.notifyUser(order.customerId, 'order_status_update', {
            orderId,
            stage,
            location,
        });
        return { ok: true };
    }
    async findByUser(userId, role) {
        if (role === client_1.UserRole.ADMIN)
            return this.prisma.order.findMany({
                include: { items: true, prescription: true },
            });
        if (role === client_1.UserRole.PHARMACY)
            return this.prisma.order.findMany({
                where: { pharmacyId: userId },
                include: { items: true, prescription: true },
            });
        if (role === client_1.UserRole.RIDER)
            return this.prisma.order.findMany({
                where: { riderId: userId },
                include: { items: true, prescription: true },
            });
        return this.prisma.order.findMany({
            where: { customerId: userId },
            include: { items: true, prescription: true },
        });
    }
    async getTimeline(orderId) {
        const events = await this.prisma.orderTimeline.findMany({
            where: { orderId },
            orderBy: { createdAt: 'asc' },
        });
        return events.map((e) => ({
            event: e.event,
            data: e.data ? JSON.parse(e.data) : {},
            at: e.createdAt,
        }));
    }
    async getRiderScorePublic(rp, lat, lon) {
        let base = 50;
        if (typeof rp.distKm === 'number') {
            base = Math.max(1, Math.round(Math.max(0, 100 - rp.distKm * 10)));
        }
        else if (lat != null && lon != null && rp.meta?.lat && rp.meta?.lon) {
            try {
                const km = this.haversineKm(Number(rp.meta.lat), Number(rp.meta.lon), lat, lon);
                base = Math.max(1, Math.round(Math.max(0, 100 - km * 10)));
            }
            catch {
                base = 10;
            }
        }
        else {
            base = 10;
        }
        try {
            const match = (rp.memberId || '').match(/^rider:(\d+)$/);
            const riderId = match ? Number(match[1]) : NaN;
            if (!isNaN(riderId)) {
                const r = await this.prisma.user.findUnique({
                    where: { id: riderId },
                    select: { status: true },
                });
                if (r?.status === 'AVAILABLE')
                    base += 20;
            }
        }
        catch { }
        return Math.min(100, base);
    }
    async adminForceCancel(orderId, reason) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: client_1.OrderStatus.CANCELED, riderId: null },
        });
        await this.logTimeline(orderId, 'ADMIN_FORCE_CANCEL', { reason });
        this.ws.notifyUser(order.customerId, 'order_canceled', {
            orderId,
            reason,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order_canceled', {
                orderId,
                reason,
            });
        }
        if (typeof this.ws.notifyAdmins === 'function') {
            this.ws.notifyAdmins('admin_order_override', {
                orderId,
                action: 'CANCEL',
            });
        }
        return updated;
    }
    async adminForceStatus(orderId, status, note) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status },
        });
        await this.logTimeline(orderId, 'ADMIN_FORCE_STATUS', {
            to: status,
            note,
        });
        this.ws.notifyUser(order.customerId, 'order_status_update', {
            orderId,
            status,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order_status_update', {
                orderId,
                status,
            });
        }
        return updated;
    }
    async adminUnassignRider(orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!order.riderId)
            return order;
        await this.prisma.user.update({
            where: { id: order.riderId },
            data: { status: 'AVAILABLE' },
        });
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { riderId: null, status: client_1.OrderStatus.ASSIGNED },
        });
        await this.logTimeline(orderId, 'ADMIN_UNASSIGNED_RIDER');
        return updated;
    }
    async adminAddNote(orderId, note) {
        await this.logTimeline(orderId, 'ADMIN_NOTE', { note });
        return { ok: true };
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
