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
const rider_payments_service_1 = require("../riders/rider-payments.service");
const rider_quality_service_1 = require("../riders/rider-quality.service");
const order_lifecycle_service_1 = require("./order-lifecycle.service");
const client_1 = require("@prisma/client");
const service_area_service_1 = require("../service-area/service-area.service");
const NEEDS_CONFIRMATION_STATUS = 'NEEDS_CONFIRMATION';
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma, notify, ws, config, surge, geoSurge, payments, riderPayments, riderQuality, lifecycle, serviceArea, orderAssignQueue) {
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.config = config;
        this.surge = surge;
        this.geoSurge = geoSurge;
        this.payments = payments;
        this.riderPayments = riderPayments;
        this.riderQuality = riderQuality;
        this.lifecycle = lifecycle;
        this.serviceArea = serviceArea;
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
    async requestCustomerPayment(order) {
        const current = String(order.paymentStatus || 'UNPAID').toUpperCase();
        if (current === 'PAID' || current === 'REQUESTED')
            return { requested: false };
        const st = String(order.status || '').toUpperCase();
        if (st !== String(client_1.OrderStatus.ACCEPTED))
            return { requested: false };
        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'REQUESTED', paymentRequestedAt: new Date() },
            select: { id: true, customerId: true, pharmacyId: true },
        });
        await this.logTimeline(order.id, 'PAYMENT_REQUESTED', {
            orderId: order.id,
            paymentMode: order.paymentMode,
        });
        await this.notify.createDomainEvent(updated.customerId, 'payment.requested', `Payment requested for order #${order.id}`, { orderId: order.id }, updated.pharmacyId);
        return { requested: true };
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
            return { mode: client_1.PaymentMode.PAY_AFTER_ACCEPT, requiresPrescription: false };
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
        const resolved = this.resolveModeFromItems(dto.items);
        let mode = resolved.mode;
        let requiresPrescription = resolved.requiresPrescription;
        const meds = await this.prisma.medicine.findMany({
            where: { id: { in: medicineIds } },
            select: { id: true, rxType: true },
        });
        const anyRx = meds.some((m) => String(m.rxType).toUpperCase() !== 'NONE');
        requiresPrescription = requiresPrescription || anyRx;
        if (requiresPrescription) {
            mode = client_1.PaymentMode.PAY_AFTER_VERIFICATION;
        }
        const orderGeoId = `order:${Date.now()}:${Math.random()
            .toString()
            .slice(2)}`;
        const user = await this.prisma.user.findUnique({
            where: { id: customerId },
        });
        const pickupLat = user?.latitude != null ? Number(user.latitude) : null;
        const pickupLon = user?.longitude != null ? Number(user.longitude) : null;
        await this.serviceArea.assertPointServiced(pickupLat, pickupLon);
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
                this.notify.create(customerId, 'ORDER_CREATED', `Order #${created.id} created`, { orderId: created.id, status: created.status });
                this.notify.create(pharmacyId, 'ORDER_PLACED', `Order #${created.id}`, { orderId: created.id }, customerId);
                this.ws.notifyUser(pharmacyId, 'order_placed', created);
                this.ws.notifyUser(pharmacyId, 'order.created', { order: created });
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
                where: { pharmacyId, medicineId: { in: medicineIds }, deletedAt: null },
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
            this.notify.create(customerId, 'ORDER_CREATED', `Order #${order.id} created`, { orderId: order.id, status: order.status });
            this.notify.create(order.pharmacyId, 'ORDER_PLACED', `Order #${order.id}`, { orderId: order.id }, customerId);
            this.ws.notifyUser(order.pharmacyId, 'order_placed', order);
            this.ws.notifyUser(order.pharmacyId, 'order.created', { order });
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
            this.notify.create(customerId, 'ORDER_CREATED', `Order #${created.id} created`, { orderId: created.id, status: created.status });
            this.notify.create(best, 'ORDER_AVAILABLE', `Order #${created.id}`, { orderId: created.id }, customerId);
            this.ws.notifyUser(best, 'order_available', { orderId: created.id });
            this.ws.notifyUser(best, 'order.created', { order: created });
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
        const grouped = (await this.prisma.pharmacyInventory.groupBy({
            by: ['pharmacyId'],
            where: {
                medicineId: { in: medicineIds },
                stock: { gt: 0 },
                deletedAt: null,
            },
            _count: { medicineId: true },
        }));
        const pharmacyIds = grouped
            .filter((g) => Number(g?._count?.medicineId) === medicineIds.length)
            .map((g) => g.pharmacyId);
        if (!pharmacyIds.length)
            throw new common_1.NotFoundException('No pharmacy has all items in stock');
        const scores = pharmacyIds.map((pid) => ({ pharmacyId: pid, score: 1 }));
        const bestPharmacyId = scores[0].pharmacyId;
        const inv2 = await this.prisma.pharmacyInventory.findMany({
            where: {
                pharmacyId: bestPharmacyId,
                medicineId: { in: medicineIds },
                deletedAt: null,
            },
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
        this.notify.create(customerId, 'ORDER_CREATED', `Order #${finalOrder.id} created`, { orderId: finalOrder.id, status: finalOrder.status });
        for (const pid of pharmacyIds) {
            this.notify.create(pid, 'ORDER_AVAILABLE', `Order #${finalOrder.id}`, { orderId: finalOrder.id }, customerId);
            this.ws.notifyUser(pid, 'order_available', { orderId: finalOrder.id });
        }
        if (finalOrder.pharmacyId) {
            this.ws.notifyUser(finalOrder.pharmacyId, 'order.created', {
                order: finalOrder,
            });
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
                    this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                        orderId: order.id,
                        prescriptionId: pres.id,
                    });
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
        this.ws.notifyUser(pharmacyId, 'order.updated', {
            orderId,
            requiresPrescription: true,
        });
        return { ok: true };
    }
    async transitionStatus(args) {
        return this.lifecycle.transition({
            orderId: args.orderId,
            actor: args.actor,
            from: args.from,
            to: args.to,
            event: args.event,
            data: args.data,
            extraUpdate: args.extraUpdate,
        });
    }
    async pharmacyRespond(pharmacyId, orderId, action) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, prescription: true } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId) {
            throw new common_1.BadRequestException('Not authorized for this order');
        }
        if (order.status !== client_1.OrderStatus.PENDING) {
            throw new common_1.BadRequestException(`Order cannot be ${action.toLowerCase()} from status ${order.status}`);
        }
        if (action === 'ACCEPTED' && order.requiresPrescription && !order.prescriptionId) {
            throw new common_1.BadRequestException('Prescription required to accept this order');
        }
        if (action === 'REJECTED') {
            await this.prisma.orderOffer.updateMany({
                where: { orderId, pharmacyId },
                data: { status: 'REJECTED' },
            });
            return this.pharmacyReject(pharmacyId, orderId);
        }
        await this.prisma.orderOffer.updateMany({
            where: { orderId, pharmacyId: { not: pharmacyId } },
            data: { status: 'REJECTED' },
        });
        const acceptRes = await this.pharmacyAccept(pharmacyId, orderId, {});
        const updated = acceptRes?.order;
        if (!updated)
            return acceptRes;
        if (String(updated.status) !== String(client_1.OrderStatus.ACCEPTED)) {
            return { order: updated };
        }
        this.ws.notifyAdmins('admin_order_override', {
            orderId,
            status: client_1.OrderStatus.ACCEPTED,
            pharmacyId,
        });
        this.ws.notifyRiders('order.available', { orderId, pharmacyId });
        if (updated.paymentMode === client_1.PaymentMode.PAY_AFTER_ACCEPT ||
            updated.paymentMode === client_1.PaymentMode.PAY_AFTER_VERIFICATION) {
            await this.requestCustomerPayment(updated);
            return { order: updated, paymentStatus: 'REQUESTED' };
        }
        const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60000;
        await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
        return { order: updated };
    }
    async riderRespond(riderId, orderId, action, reason) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (action === 'ACCEPTED') {
            const now = new Date();
            const offer = await this.prisma.orderOffer.findFirst({
                where: {
                    orderId,
                    riderId,
                    offeredTo: 'RIDER',
                    status: 'PENDING',
                    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!offer) {
                throw new common_1.BadRequestException('No active offer for this order');
            }
            const updated = await this.prisma.$transaction(async (tx) => {
                const locked = await tx.order.updateMany({
                    where: {
                        id: orderId,
                        riderId: null,
                        status: { in: [client_1.OrderStatus.ASSIGNED] },
                    },
                    data: { riderId, status: client_1.OrderStatus.ASSIGNED, riderAssignedAt: now },
                });
                if (!locked || locked.count !== 1) {
                    throw new common_1.BadRequestException('Order already assigned');
                }
                await tx.orderOffer.update({
                    where: { id: offer.id },
                    data: { status: 'ACCEPTED', respondedAt: now },
                });
                await tx.orderOffer.updateMany({
                    where: { orderId, offeredTo: 'RIDER', status: 'PENDING' },
                    data: {
                        status: 'EXPIRED',
                        respondedAt: now,
                        rejectReason: 'OTHER_RIDER_ACCEPTED',
                    },
                });
                await tx.user.update({
                    where: { id: riderId },
                    data: { riderAvailability: 'BUSY' },
                });
                return tx.order.findUnique({
                    where: { id: orderId },
                });
            });
            if (!updated) {
                throw new common_1.BadRequestException('Order already assigned');
            }
            await this.logTimeline(orderId, 'RIDER_ACCEPTED', { riderId, offerId: offer.id });
            this.notify.create(order.customerId, 'RIDER_ASSIGNED', `Rider assigned for order #${orderId}`, { orderId, riderId }, riderId);
            await this.notify.createDomainEvent(updated.customerId, 'order.assigned', `Rider assigned for order #${orderId}`, { orderId, riderId }, riderId);
            if (updated.pharmacyId) {
                await this.notify.createDomainEvent(updated.pharmacyId, 'order.assigned', `Rider assigned for order #${orderId}`, { orderId, riderId }, riderId);
            }
            await this.notify.createDomainEvent(riderId, 'order.assigned', `You were assigned to order #${orderId}`, { orderId, riderId }, riderId);
            if (updated.pharmacyId) {
                this.ws.notifyUser(updated.pharmacyId, 'order.updated', {
                    orderId,
                    status: updated.status,
                    riderId,
                });
            }
            this.ws.notifyUser(updated.customerId, 'order_status_update', {
                orderId,
                stage: client_1.OrderStatus.ASSIGNED,
                riderId,
            });
            this.ws.notifyAdmins('order.assigned', { orderId, riderId });
            return updated;
        }
        const now = new Date();
        const offer = await this.prisma.orderOffer.findFirst({
            where: {
                orderId,
                riderId,
                offeredTo: 'RIDER',
                status: 'PENDING',
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!offer)
            return { ok: true };
        await this.prisma.orderOffer.update({
            where: { id: offer.id },
            data: {
                status: 'REJECTED',
                respondedAt: now,
                rejectReason: reason ? String(reason).slice(0, 200) : 'RIDER_REJECTED',
            },
        });
        await this.logTimeline(orderId, 'RIDER_REJECTED', {
            riderId,
            offerId: offer.id,
            reason: reason || null,
        });
        const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
        const pending = await this.prisma.orderOffer.count({
            where: {
                orderId,
                offeredTo: 'RIDER',
                status: 'PENDING',
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        });
        if (pending === 0) {
            await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
        }
        try {
            await this.riderQuality.onRiderRejectedOffer(riderId);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Rapid reject check failed for rider ${riderId}: ${msg}`);
        }
        return { ok: true };
    }
    async rateRider(customerId, orderId, dto) {
        return this.riderQuality.recordRating({
            customerId,
            orderId,
            rating: dto.rating,
            comment: dto.comment,
        });
    }
    async riderReportIssue(riderId, orderId, dto) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.riderId !== riderId)
            throw new common_1.BadRequestException('Not your order');
        const status = order.status;
        const allowed = status === client_1.OrderStatus.REACHED_PHARMACY ||
            status === client_1.OrderStatus.PICKED_UP ||
            status === client_1.OrderStatus.OUT_FOR_DELIVERY;
        if (!allowed) {
            throw new common_1.BadRequestException(`Cannot report issue in status ${status}`);
        }
        const type = String(dto?.type || 'OTHER').toUpperCase();
        const note = dto?.note != null ? String(dto.note).slice(0, 300) : null;
        const loc = dto?.lat != null && dto?.lng != null
            ? { lat: Number(dto.lat), lng: Number(dto.lng) }
            : null;
        await this.logTimeline(orderId, 'RIDER_ISSUE', {
            riderId,
            type,
            note,
            location: loc,
            status,
        });
        this.notify.create(order.customerId, 'ORDER_ISSUE', `Delivery issue reported for order #${orderId}`, { orderId, type, note }, riderId);
        if (order.pharmacyId) {
            this.notify.create(order.pharmacyId, 'ORDER_ISSUE', `Rider reported an issue for order #${orderId}`, { orderId, type, note }, riderId);
        }
        this.ws.notifyUser(order.customerId, 'order.updated', {
            orderId,
            status: order.status,
            issue: { type, note },
        });
        this.ws.notifyAdmins?.('order.issue', {
            orderId,
            riderId,
            type,
            note,
            status,
        });
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
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: riderId },
                data: { riderAvailability: 'BUSY' },
            });
            const res = await this.lifecycle.forceStatus({
                orderId,
                actor: { id: adminId, role: client_1.UserRole.ADMIN },
                to: client_1.OrderStatus.ASSIGNED,
                event: 'ASSIGNED_BY_ADMIN',
                data: { adminId, riderId },
                extraUpdate: { riderId, riderAssignedAt: now },
                db: tx,
            });
            return res.order;
        });
        this.notify.create(updated.customerId, 'ORDER_ASSIGNED_BY_ADMIN', `Order #${orderId} assigned`, { orderId }, adminId);
        this.notify.create(updated.customerId, 'RIDER_ASSIGNED', `Rider assigned for order #${orderId}`, { orderId, riderId }, adminId);
        this.ws.notifyUser(updated.customerId, 'order_status_update', {
            orderId,
            stage: client_1.OrderStatus.ASSIGNED,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.ASSIGNED,
                riderId,
            });
        }
        await this.notify.createDomainEvent(updated.customerId, 'order.assigned', `Rider assigned for order #${orderId}`, { orderId, riderId }, adminId);
        if (order.pharmacyId) {
            await this.notify.createDomainEvent(order.pharmacyId, 'order.assigned', `Rider assigned for order #${orderId}`, { orderId, riderId }, adminId);
        }
        await this.notify.createDomainEvent(riderId, 'order.assigned', `You were assigned to order #${orderId}`, { orderId, riderId }, adminId);
        this.ws.notifyAdmins('order.assigned', { orderId, riderId, by: 'ADMIN' });
        return updated;
    }
    async updateStage(riderId, orderId, stage, location, proof) {
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
        const current = order.status;
        const isNoopStage = stage === current;
        const allowed = isNoopStage ||
            (current === client_1.OrderStatus.ASSIGNED && stage === client_1.OrderStatus.REACHED_PHARMACY) ||
            (current === client_1.OrderStatus.PICKED_UP && stage === client_1.OrderStatus.OUT_FOR_DELIVERY) ||
            (current === client_1.OrderStatus.OUT_FOR_DELIVERY && stage === client_1.OrderStatus.DELIVERED);
        if (!allowed || stage === client_1.OrderStatus.PICKED_UP) {
            throw new common_1.BadRequestException(`Invalid stage transition ${current} → ${stage}`);
        }
        const now = new Date();
        let stageAfter = stage;
        let changed = false;
        if (!isNoopStage) {
            const extraUpdate = {};
            if (stage === client_1.OrderStatus.REACHED_PHARMACY)
                extraUpdate.reachedPharmacyAt = now;
            if (stage === client_1.OrderStatus.OUT_FOR_DELIVERY)
                extraUpdate.outForDeliveryAt = now;
            if (stage === client_1.OrderStatus.DELIVERED)
                extraUpdate.deliveredAt = now;
            if (stage === client_1.OrderStatus.DELIVERED) {
                const proofUrl = proof?.proofUrl != null ? String(proof.proofUrl).trim() : '';
                const signatureUrl = proof?.signatureUrl != null ? String(proof.signatureUrl).trim() : '';
                const otp = proof?.otp != null ? String(proof.otp).trim() : '';
                if (proofUrl) {
                    if (proofUrl.length > 1000) {
                        throw new common_1.BadRequestException('proofUrl too long');
                    }
                    if (!/^https?:\/\//i.test(proofUrl)) {
                        throw new common_1.BadRequestException('proofUrl must be a valid URL');
                    }
                    extraUpdate.deliveryProofUrl = proofUrl;
                }
                if (signatureUrl) {
                    if (signatureUrl.length > 1000) {
                        throw new common_1.BadRequestException('signatureUrl too long');
                    }
                    extraUpdate.deliverySignatureUrl = signatureUrl;
                }
                if (otp) {
                    if (otp.length > 20)
                        throw new common_1.BadRequestException('otp too long');
                    extraUpdate.deliveryOtp = otp;
                }
            }
            const event = stage === client_1.OrderStatus.REACHED_PHARMACY
                ? 'REACHED_PHARMACY'
                : stage === client_1.OrderStatus.OUT_FOR_DELIVERY
                    ? 'OUT_FOR_DELIVERY'
                    : stage === client_1.OrderStatus.DELIVERED
                        ? 'DELIVERED'
                        : `STAGE_${String(stage)}`;
            const res = await this.transitionStatus({
                orderId,
                actor: { id: riderId, role: client_1.UserRole.RIDER },
                from: current,
                to: stage,
                event,
                data: {
                    riderId,
                    proofUrl: extraUpdate.deliveryProofUrl ?? null,
                    signatureUrl: extraUpdate.deliverySignatureUrl ?? null,
                    otpProvided: extraUpdate.deliveryOtp ? true : false,
                },
                extraUpdate,
            });
            changed = res.changed;
            stageAfter = res.order?.status ?? stage;
        }
        if (changed && String(stageAfter) === String(client_1.OrderStatus.REACHED_PHARMACY)) {
            await this.logTimeline(orderId, 'RIDER_ARRIVED', { riderId });
            await this.notify.createDomainEvent(order.customerId, 'rider.arrived', `Rider arrived at pharmacy for order #${orderId}`, { orderId, riderId }, riderId);
            if (order.pharmacyId) {
                await this.notify.createDomainEvent(order.pharmacyId, 'rider.arrived', `Rider arrived for order #${orderId}`, { orderId, riderId }, riderId);
            }
            this.ws.notifyAdmins('rider.arrived', { orderId, riderId });
        }
        if (stage === client_1.OrderStatus.DELIVERED && changed) {
            await this.prisma.user.update({
                where: { id: riderId },
                data: { riderAvailability: 'AVAILABLE' },
            });
            try {
                await this.riderPayments.ensureDeliveryEarningForOrder(orderId);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Rider earning create failed for order ${orderId}: ${msg}`);
            }
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
            stage: stageAfter,
            location,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                status: stageAfter,
                location,
            });
        }
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
    async listForPharmacy(pharmacyId, status) {
        const where = { pharmacyId };
        if (status && Object.values(client_1.OrderStatus).includes(status)) {
            where.status = status;
        }
        return this.prisma.order.findMany({
            where,
            include: {
                items: true,
                customer: { select: { id: true, name: true, email: true, phone: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getForPharmacy(pharmacyId, orderId) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, pharmacyId },
            include: {
                items: true,
                prescription: true,
                timeline: { orderBy: { createdAt: 'asc' } },
                customer: { select: { id: true, name: true, email: true, phone: true } },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        return order;
    }
    async pharmacyAccept(pharmacyId, orderId, dto) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId)
            throw new common_1.BadRequestException('Not authorized for this order');
        if (order.status !== client_1.OrderStatus.PENDING) {
            return { order };
        }
        const manualMap = new Map();
        for (const it of dto?.manualItems ?? []) {
            manualMap.set(Number(it.orderItemId), {
                price: Number(it.price),
                note: it.note,
            });
        }
        const medicineIds = (order.items || [])
            .map((i) => i.medicineId)
            .filter((v) => typeof v === 'number');
        const inv = await this.prisma.pharmacyInventory.findMany({
            where: { pharmacyId, medicineId: { in: medicineIds }, deletedAt: null },
            select: {
                id: true,
                medicineId: true,
                sellingPrice: true,
                discount: true,
                stock: true,
            },
        });
        const invMap = new Map();
        for (const row of inv) {
            invMap.set(Number(row.medicineId), {
                inventoryId: Number(row.id),
                price: Number(row.sellingPrice),
                discount: Number(row.discount ?? 0),
                stock: Number(row.stock ?? 0),
            });
        }
        const pricedItems = [];
        const missingItems = [];
        const stockAllocations = [];
        let total = 0;
        for (const item of order.items || []) {
            const manual = manualMap.get(item.id);
            if (manual) {
                const price = Number(manual.price);
                pricedItems.push({
                    orderItemId: item.id,
                    medicineId: item.medicineId ?? null,
                    name: item.name,
                    quantity: item.quantity,
                    price,
                    source: 'manual',
                    discount: null,
                    note: manual.note,
                });
                total += price * Number(item.quantity || 1);
                continue;
            }
            const medicineId = item.medicineId ?? undefined;
            if (medicineId && invMap.has(Number(medicineId))) {
                const row = invMap.get(Number(medicineId));
                const requestedQty = Number(item.quantity || 1);
                const availableQty = Math.max(0, Number(row.stock ?? 0));
                const fulfillQty = Math.min(requestedQty, availableQty);
                if (fulfillQty <= 0) {
                    missingItems.push({
                        orderItemId: item.id,
                        medicineId,
                        name: item.name,
                        requestedQuantity: requestedQty,
                        availableStock: availableQty,
                        reason: 'INSUFFICIENT_STOCK',
                    });
                    continue;
                }
                const price = Number(row.price);
                pricedItems.push({
                    orderItemId: item.id,
                    medicineId,
                    name: item.name,
                    quantity: fulfillQty,
                    requestedQuantity: requestedQty,
                    price,
                    source: 'inventory',
                    discount: row.discount,
                });
                total += price * fulfillQty;
                stockAllocations.push({
                    inventoryId: row.inventoryId,
                    medicineId,
                    quantity: fulfillQty,
                    requestedQuantity: requestedQty,
                });
                continue;
            }
            missingItems.push({
                orderItemId: item.id,
                medicineId: item.medicineId ?? null,
                name: item.name,
                quantity: item.quantity,
                currentPrice: item.price,
                reason: 'NOT_IN_INVENTORY',
            });
            total += Number(item.price) * Number(item.quantity || 1);
        }
        const needsConfirmation = missingItems.length > 0 ||
            stockAllocations.some((a) => a.quantity !== a.requestedQuantity) ||
            pricedItems.some((p) => p.source === 'manual') ||
            (dto?.totalPrice != null &&
                Number.isFinite(Number(dto.totalPrice)) &&
                Number(dto.totalPrice) !== total);
        if (dto?.totalPrice != null && Number.isFinite(Number(dto.totalPrice))) {
            total = Number(dto.totalPrice);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            for (const p of pricedItems) {
                const data = { price: Number(p.price) };
                if (Number.isFinite(Number(p.requestedQuantity)) &&
                    Number.isFinite(Number(p.quantity)) &&
                    Number(p.quantity) !== Number(p.requestedQuantity)) {
                    data.quantity = Number(p.quantity);
                }
                await tx.orderItem.update({
                    where: { id: p.orderItemId },
                    data,
                });
            }
            for (const a of stockAllocations) {
                const res = await tx.pharmacyInventory.updateMany({
                    where: {
                        id: a.inventoryId,
                        deletedAt: null,
                        stock: { gte: a.quantity },
                    },
                    data: { stock: { decrement: a.quantity } },
                });
                if (!res || res.count !== 1) {
                    throw new common_1.BadRequestException(`Insufficient stock for medicine ${a.medicineId}`);
                }
            }
            if (pricedItems.length === 0) {
                const { order: updated } = await this.lifecycle.transition({
                    orderId,
                    actor: { id: pharmacyId, role: client_1.UserRole.PHARMACY },
                    from: client_1.OrderStatus.PENDING,
                    to: client_1.OrderStatus.REJECTED,
                    event: 'PHARMACY_REJECTED_OUT_OF_STOCK',
                    data: { pharmacyId, missingItems },
                    db: tx,
                });
                return updated;
            }
            const nextStatus = needsConfirmation
                ? NEEDS_CONFIRMATION_STATUS
                : client_1.OrderStatus.ACCEPTED;
            const { order: updated } = await this.lifecycle.transition({
                orderId,
                actor: { id: pharmacyId, role: client_1.UserRole.PHARMACY },
                from: client_1.OrderStatus.PENDING,
                to: nextStatus,
                event: nextStatus === NEEDS_CONFIRMATION_STATUS ? 'ORDER_NEEDS_CONFIRMATION' : 'PHARMACY_ACCEPTED',
                data: {
                    pharmacyId,
                    totalPrice: total,
                    pricedItems,
                    missingItems,
                    needsConfirmation,
                },
                extraUpdate: { totalPrice: total },
                db: tx,
            });
            return updated;
        });
        if (String(updated.status) === String(client_1.OrderStatus.REJECTED)) {
            this.notify.create(order.customerId, 'ORDER_REJECTED', `Order #${orderId} rejected (out of stock)`, { orderId, missingItems }, pharmacyId);
            this.ws.notifyUser(order.customerId, 'order_status_update', {
                orderId,
                stage: client_1.OrderStatus.REJECTED,
            });
            this.ws.notifyUser(pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.REJECTED,
            });
            return { order: updated };
        }
        const ttAcceptSec = order?.createdAt
            ? Math.max(0, Math.floor((Date.now() - order.createdAt.getTime()) / 1000))
            : null;
        await this.logTimeline(orderId, 'PHARMACY_PRICED', {
            pharmacyId,
            totalPrice: total,
            pricedItems,
            missingItems,
            needsConfirmation,
            ttAcceptSec,
        });
        if (needsConfirmation) {
            this.notify.create(order.customerId, 'ORDER_NEEDS_CONFIRMATION', `Order #${orderId} has price changes. Please confirm.`, { orderId, totalPrice: total, pricedItems, missingItems }, pharmacyId);
            this.ws.notifyUser(order.customerId, 'order_needs_confirmation', {
                orderId,
                totalPrice: total,
                pricedItems,
                missingItems,
            });
        }
        else {
            this.notify.create(order.customerId, 'ORDER_ACCEPTED', `Order #${orderId} accepted by pharmacy`, { orderId, totalPrice: total }, pharmacyId);
            this.ws.notifyUser(order.customerId, 'order_status_update', {
                orderId,
                stage: client_1.OrderStatus.ACCEPTED,
            });
            if (String(order.paymentMode) === String(client_1.PaymentMode.PAY_AFTER_ACCEPT)) {
                await this.requestCustomerPayment({
                    id: orderId,
                    customerId: order.customerId,
                    pharmacyId,
                    status: client_1.OrderStatus.ACCEPTED,
                    paymentMode: order.paymentMode,
                    paymentStatus: updated.paymentStatus,
                });
            }
        }
        this.ws.notifyUser(pharmacyId, 'order.updated', {
            orderId,
            status: updated.status,
            totalPrice: Number(updated.totalPrice),
            needsConfirmation,
        });
        return { order: updated };
    }
    async pharmacyReject(pharmacyId, orderId, reason) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId)
            throw new common_1.BadRequestException('Not authorized for this order');
        const ttAcceptSec = order?.createdAt
            ? Math.max(0, Math.floor((Date.now() - order.createdAt.getTime()) / 1000))
            : null;
        if (order.status !== client_1.OrderStatus.PENDING) {
            if (order.status === client_1.OrderStatus.REJECTED)
                return { ok: true };
            throw new common_1.BadRequestException(`Cannot reject order in status ${order.status}`);
        }
        const { changed } = await this.transitionStatus({
            orderId,
            actor: { id: pharmacyId, role: client_1.UserRole.PHARMACY },
            from: client_1.OrderStatus.PENDING,
            to: client_1.OrderStatus.REJECTED,
            event: 'PHARMACY_REJECTED',
            data: { pharmacyId, reason, ttAcceptSec },
        });
        if (!changed)
            return { ok: true };
        this.notify.create(order.customerId, 'ORDER_REJECTED', `Order #${orderId} rejected by pharmacy`, { orderId, reason }, pharmacyId);
        this.ws.notifyUser(order.customerId, 'order_status_update', {
            orderId,
            stage: client_1.OrderStatus.REJECTED,
            reason,
        });
        this.ws.notifyUser(pharmacyId, 'order.updated', {
            orderId,
            status: client_1.OrderStatus.REJECTED,
        });
        this.ws.notifyAdmins?.('admin_order_override', {
            orderId,
            status: client_1.OrderStatus.REJECTED,
            pharmacyId,
            reason,
        });
        return { ok: true };
    }
    async pharmacyMarkReady(pharmacyId, orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { prescription: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId)
            throw new common_1.BadRequestException('Not authorized for this order');
        if (order.status !== client_1.OrderStatus.ACCEPTED) {
            if (order.status === client_1.OrderStatus.ASSIGNED)
                return { order };
            throw new common_1.BadRequestException(`Cannot mark ready in status ${order.status}`);
        }
        if (order.paymentMode === client_1.PaymentMode.PAY_AFTER_ACCEPT ||
            order.paymentMode === client_1.PaymentMode.PAY_AFTER_VERIFICATION) {
            const ps = String(order.paymentStatus || 'UNPAID').toUpperCase();
            if (ps !== 'PAID') {
                throw new common_1.BadRequestException('Payment required before marking ready');
            }
        }
        if (order.requiresPrescription) {
            if (!order.prescriptionId || !order.prescription) {
                throw new common_1.BadRequestException('Prescription required for this order');
            }
            if (!order.prescription.verified) {
                throw new common_1.BadRequestException('Prescription must be verified first');
            }
        }
        const { order: updated, changed } = await this.transitionStatus({
            orderId,
            actor: { id: pharmacyId, role: client_1.UserRole.PHARMACY },
            from: client_1.OrderStatus.ACCEPTED,
            to: client_1.OrderStatus.ASSIGNED,
            event: 'PHARMACY_READY',
            data: { pharmacyId },
        });
        if (changed) {
            const delay = 0;
            await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
            this.ws.notifyAdmins('order_ready', { orderId });
            this.ws.notifyUser(order.customerId, 'order_status_update', {
                orderId,
                stage: client_1.OrderStatus.ASSIGNED,
            });
            this.ws.notifyUser(pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.ASSIGNED,
            });
        }
        return { order: updated };
    }
    async pharmacyConfirmHandover(pharmacyId, orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId)
            throw new common_1.BadRequestException('Not authorized for this order');
        if (!order.riderId)
            throw new common_1.BadRequestException('Rider not assigned yet');
        if (order.status !== client_1.OrderStatus.REACHED_PHARMACY) {
            if (order.status === client_1.OrderStatus.PICKED_UP)
                return { order };
            throw new common_1.BadRequestException(`Cannot confirm handover in status ${order.status}`);
        }
        const now = new Date();
        const { order: updated, changed } = await this.transitionStatus({
            orderId,
            actor: { id: pharmacyId, role: client_1.UserRole.PHARMACY },
            from: client_1.OrderStatus.REACHED_PHARMACY,
            to: client_1.OrderStatus.PICKED_UP,
            event: 'PICKED_UP',
            data: { pharmacyId, riderId: order.riderId, source: 'pharmacy_confirm_handover' },
            extraUpdate: { pickedUpAt: now },
        });
        if (changed) {
            await this.logTimeline(orderId, 'PHARMACY_HANDOVER_CONFIRMED', {
                pharmacyId,
                riderId: order.riderId,
            });
        }
        if (changed) {
            this.notify.create(order.customerId, 'ORDER_PICKED_UP', `Order #${orderId} picked up`, { orderId, riderId: order.riderId }, pharmacyId);
            this.ws.notifyUser(order.customerId, 'order_status_update', {
                orderId,
                stage: client_1.OrderStatus.PICKED_UP,
            });
            this.ws.notifyUser(order.riderId, 'order_status_update', {
                orderId,
                stage: client_1.OrderStatus.PICKED_UP,
            });
            this.ws.notifyUser(pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.PICKED_UP,
                riderId: order.riderId,
            });
            this.ws.notifyAdmins('admin_order_override', {
                orderId,
                status: client_1.OrderStatus.PICKED_UP,
                pharmacyId,
                riderId: order.riderId,
            });
        }
        return { order: updated };
    }
    async pharmacyVerifyPrescription(pharmacyId, orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { prescription: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.pharmacyId !== pharmacyId)
            throw new common_1.BadRequestException('Not authorized for this order');
        if (!order.prescriptionId || !order.prescription)
            throw new common_1.BadRequestException('No prescription uploaded');
        if (order.prescription.verified)
            return { ok: true, verified: true };
        await this.prisma.prescription.update({
            where: { id: order.prescriptionId },
            data: { verified: true },
        });
        if (order.paymentMode === client_1.PaymentMode.PAY_AFTER_VERIFICATION &&
            String(order.status) === String(client_1.OrderStatus.ACCEPTED)) {
            await this.requestCustomerPayment(order);
        }
        await this.logTimeline(orderId, 'PRESCRIPTION_VERIFIED', {
            by: 'PHARMACY',
            pharmacyId,
            prescriptionId: order.prescriptionId,
        });
        this.notify.create(order.customerId, 'PRESCRIPTION_VERIFIED', `Prescription verified for order #${orderId}`, { orderId, prescriptionId: order.prescriptionId }, pharmacyId);
        this.ws.notifyUser(order.customerId, 'prescription_verified', {
            orderId,
            prescriptionId: order.prescriptionId,
        });
        this.ws.notifyUser(pharmacyId, 'order.updated', {
            orderId,
            prescriptionId: order.prescriptionId,
            prescriptionVerified: true,
        });
        return { ok: true, verified: true };
    }
    async adminVerifyPrescription(orderId, adminId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { prescription: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!order.prescriptionId || !order.prescription)
            throw new common_1.BadRequestException('No prescription uploaded');
        if (!order.prescription.verified) {
            await this.prisma.prescription.update({
                where: { id: order.prescriptionId },
                data: { verified: true },
            });
        }
        await this.logTimeline(orderId, 'PRESCRIPTION_VERIFIED', {
            by: 'ADMIN',
            adminId,
            prescriptionId: order.prescriptionId,
        });
        this.notify.create(order.customerId, 'PRESCRIPTION_VERIFIED', `Prescription verified for order #${orderId}`, { orderId, prescriptionId: order.prescriptionId }, adminId);
        this.ws.notifyUser(order.customerId, 'prescription_verified', {
            orderId,
            prescriptionId: order.prescriptionId,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                prescriptionId: order.prescriptionId,
                prescriptionVerified: true,
            });
        }
        return { ok: true, verified: true };
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
    async getTimelineForUser(userId, role, orderId) {
        if (!Number.isFinite(orderId))
            throw new common_1.BadRequestException('Invalid order');
        const r = String(role || '').toUpperCase();
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, customerId: true, pharmacyId: true, riderId: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const allowed = r === String(client_1.UserRole.ADMIN) ||
            order.customerId === userId ||
            order.pharmacyId === userId ||
            (order.riderId != null && order.riderId === userId);
        if (!allowed)
            throw new common_1.BadRequestException('Not authorized for this order');
        const raw = await this.getTimeline(orderId);
        if (r !== String(client_1.UserRole.CUSTOMER))
            return raw;
        const hiddenExact = new Set([
            'PHARMACY_SLA_BREACHED',
            'PHARMACY_SLA_WARNING',
            'ORDER_ESCALATION',
            'ORDER_OFFER_CREATED',
            'OFFER_DISPATCHED',
            'OFFER_EXPIRED',
            'RIDER_RAPID_REJECT',
            'RIDER_REJECTED',
            'ADMIN_FORCE_STATUS',
            'ADMIN_FORCE_CANCEL',
            'ADMIN_UNASSIGNED_RIDER',
            'ASSIGNED_BY_ADMIN',
            'ADMIN_SETTLED_ORDER',
            'ADMIN_UNSETTLED_ORDER',
        ]);
        return raw.filter((e) => {
            const ev = String(e?.event || '').toUpperCase();
            if (!ev)
                return false;
            if (hiddenExact.has(ev))
                return false;
            if (ev.startsWith('ADMIN_'))
                return false;
            if (ev.includes('SLA'))
                return false;
            if (ev.includes('OFFER'))
                return false;
            if (ev.includes('ESCALAT'))
                return false;
            if (ev.includes('PENALTY') || ev.includes('STRIKE') || ev.includes('FRAUD'))
                return false;
            return true;
        });
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
                    select: { riderAvailability: true },
                });
                if (r?.riderAvailability === 'AVAILABLE')
                    base += 20;
            }
        }
        catch { }
        return Math.min(100, base);
    }
    async adminForceCancel(orderId, reason, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.status === client_1.OrderStatus.CANCELED)
            return order;
        const riderIdBefore = order.riderId;
        const { order: updated, changed } = await this.transitionStatus({
            orderId,
            actor: { id: Number(adminId) || 0, role: client_1.UserRole.ADMIN },
            to: client_1.OrderStatus.CANCELED,
            event: 'ADMIN_FORCE_CANCEL',
            data: { reason },
            extraUpdate: { riderId: null },
        });
        if (!changed)
            return updated;
        if (riderIdBefore) {
            try {
                await this.riderPayments.applyCancellationPenaltyForOrder(orderId, riderIdBefore, reason);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Rider cancellation penalty failed for order ${orderId}: ${msg}`);
            }
        }
        this.ws.notifyUser(order.customerId, 'order_canceled', {
            orderId,
            reason,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order_canceled', {
                orderId,
                reason,
            });
            this.ws.notifyUser(order.pharmacyId, 'order.canceled', {
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
    async adminForceStatus(orderId, status, note, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const { order: updated, changed } = await this.lifecycle.forceStatus({
            orderId,
            actor: { id: Number(adminId) || 0, role: client_1.UserRole.ADMIN },
            to: status,
            event: 'ADMIN_FORCE_STATUS',
            data: { to: status, note },
        });
        if (!changed)
            return updated;
        this.ws.notifyUser(order.customerId, 'order_status_update', {
            orderId,
            status,
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order_status_update', {
                orderId,
                status,
            });
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                status,
            });
        }
        return updated;
    }
    async adminCompleteDelivery(orderId, adminId, opts) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.status === client_1.OrderStatus.DELIVERED)
            return { ok: true, order };
        if (order.status === client_1.OrderStatus.CANCELED || order.status === client_1.OrderStatus.REJECTED) {
            throw new common_1.BadRequestException(`Cannot deliver order in status ${order.status}`);
        }
        const now = new Date();
        const extraUpdate = { deliveredAt: now };
        const proofUrl = opts?.proofUrl != null ? String(opts.proofUrl).trim() : '';
        const signatureUrl = opts?.signatureUrl != null ? String(opts.signatureUrl).trim() : '';
        const otp = opts?.otp != null ? String(opts.otp).trim() : '';
        if (proofUrl) {
            if (proofUrl.length > 1000)
                throw new common_1.BadRequestException('proofUrl too long');
            if (!/^https?:\/\//i.test(proofUrl)) {
                throw new common_1.BadRequestException('proofUrl must be a valid URL');
            }
            extraUpdate.deliveryProofUrl = proofUrl;
        }
        if (signatureUrl) {
            if (signatureUrl.length > 1000)
                throw new common_1.BadRequestException('signatureUrl too long');
            extraUpdate.deliverySignatureUrl = signatureUrl;
        }
        if (otp) {
            if (otp.length > 20)
                throw new common_1.BadRequestException('otp too long');
            extraUpdate.deliveryOtp = otp;
        }
        const { order: updated, changed } = await this.transitionStatus({
            orderId,
            actor: { id: Number(adminId) || 0, role: client_1.UserRole.ADMIN },
            to: client_1.OrderStatus.DELIVERED,
            event: 'ADMIN_MARK_DELIVERED',
            data: {
                adminId,
                note: opts?.note,
                proofUrl: extraUpdate.deliveryProofUrl ?? null,
                signatureUrl: extraUpdate.deliverySignatureUrl ?? null,
                otpProvided: extraUpdate.deliveryOtp ? true : false,
                fromStatus: order.status,
            },
            extraUpdate,
        });
        if (changed && order.riderId) {
            await this.prisma.user.update({
                where: { id: order.riderId },
                data: { riderAvailability: 'AVAILABLE' },
            });
            try {
                await this.riderPayments.ensureDeliveryEarningForOrder(orderId);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Rider earning create failed for order ${orderId}: ${msg}`);
            }
            try {
                await this.geoSurge.removePoint(`order:${orderId}`);
            }
            catch { }
        }
        this.notify.create(order.customerId, 'ORDER_DELIVERED', `Order #${orderId} delivered (admin override).`, { orderId }, adminId);
        if (order.pharmacyId) {
            this.notify.create(order.pharmacyId, 'ORDER_DELIVERED', `Order #${orderId} delivered (admin override).`, { orderId }, adminId);
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.DELIVERED,
            });
        }
        if (order.riderId) {
            this.ws.notifyUser(order.riderId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.DELIVERED,
            });
        }
        this.ws.notifyUser(order.customerId, 'order_status_update', {
            orderId,
            stage: client_1.OrderStatus.DELIVERED,
        });
        if (typeof this.ws.notifyAdmins === 'function') {
            this.ws.notifyAdmins('admin_order_override', {
                orderId,
                action: 'DELIVERED',
            });
        }
        return { ok: true, order: updated };
    }
    async adminEscalateSla(orderId, adminId, opts) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const reason = (opts?.reason ?? '').trim();
        const note = (opts?.note ?? '').trim();
        await this.logTimeline(orderId, 'ADMIN_SLA_ESCALATED', {
            adminId,
            reason: reason || undefined,
            note: note || undefined,
            status: order.status,
        });
        const admins = await this.prisma.user.findMany({
            where: { role: client_1.UserRole.ADMIN },
            select: { id: true },
            take: 50,
        });
        await Promise.all(admins.map((a) => this.notify.createDomainEvent(a.id, 'order.sla_breached', `SLA escalated for order #${orderId}`, { orderId, reason: reason || undefined, note: note || undefined }, adminId)));
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                slaEscalated: true,
            });
        }
        return { ok: true };
    }
    async customerConfirmChanges(customerId, orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.customerId !== customerId)
            throw new common_1.BadRequestException('Not your order');
        if (order.status === client_1.OrderStatus.ACCEPTED)
            return { order };
        if (order.status !== NEEDS_CONFIRMATION_STATUS) {
            throw new common_1.BadRequestException(`Order is not awaiting confirmation (status=${order.status})`);
        }
        const { order: updated, changed } = await this.transitionStatus({
            orderId,
            actor: { id: customerId, role: client_1.UserRole.CUSTOMER },
            from: NEEDS_CONFIRMATION_STATUS,
            to: client_1.OrderStatus.ACCEPTED,
            event: 'CUSTOMER_CONFIRMED_CHANGES',
            data: { customerId },
        });
        if (!changed)
            return { order: updated };
        this.notify.create(customerId, 'ORDER_CONFIRMED', `You confirmed changes for order #${orderId}`, { orderId }, customerId);
        this.ws.notifyUser(customerId, 'order_status_update', {
            orderId,
            stage: client_1.OrderStatus.ACCEPTED,
        });
        if (order.pharmacyId) {
            this.notify.create(order.pharmacyId, 'ORDER_CONFIRMED', `Customer confirmed changes for order #${orderId}`, { orderId }, customerId);
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.ACCEPTED,
            });
        }
        if (order.paymentMode === client_1.PaymentMode.PAY_AFTER_ACCEPT) {
            await this.requestCustomerPayment({
                id: orderId,
                customerId,
                pharmacyId: order.pharmacyId,
                status: client_1.OrderStatus.ACCEPTED,
                paymentMode: order.paymentMode,
                paymentStatus: updated.paymentStatus,
            });
        }
        return { order: updated };
    }
    async customerRejectChanges(customerId, orderId, reason) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (order.customerId !== customerId)
            throw new common_1.BadRequestException('Not your order');
        if (order.status === client_1.OrderStatus.CANCELED)
            return { order };
        if (order.status !== NEEDS_CONFIRMATION_STATUS) {
            throw new common_1.BadRequestException(`Order is not awaiting confirmation (status=${order.status})`);
        }
        const { order: updated, changed } = await this.transitionStatus({
            orderId,
            actor: { id: customerId, role: client_1.UserRole.CUSTOMER },
            from: NEEDS_CONFIRMATION_STATUS,
            to: client_1.OrderStatus.CANCELED,
            event: 'CUSTOMER_REJECTED_CHANGES',
            data: { customerId, reason },
            extraUpdate: { riderId: null },
        });
        if (!changed)
            return { order: updated };
        if (order.riderId) {
            try {
                await this.riderPayments.applyCancellationPenaltyForOrder(orderId, order.riderId, reason || 'CUSTOMER_REJECTED_CHANGES');
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.warn(`Rider cancellation penalty failed for order ${orderId}: ${msg}`);
            }
        }
        this.ws.notifyUser(customerId, 'order_canceled', {
            orderId,
            reason: reason || 'Customer rejected pharmacy changes',
        });
        if (order.pharmacyId) {
            this.notify.create(order.pharmacyId, 'ORDER_CANCELED', `Order #${orderId} canceled by customer (changes rejected)`, { orderId, reason }, customerId);
            this.ws.notifyUser(order.pharmacyId, 'order.canceled', {
                orderId,
                reason: reason || 'Customer rejected pharmacy changes',
            });
        }
        return { order: updated };
    }
    async adminUnassignRider(orderId, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        if (!order.riderId)
            return order;
        await this.prisma.user.update({
            where: { id: order.riderId },
            data: { riderAvailability: 'AVAILABLE' },
        });
        const { order: updated } = await this.lifecycle.forceStatus({
            orderId,
            actor: { id: Number(adminId) || 0, role: client_1.UserRole.ADMIN },
            to: client_1.OrderStatus.ASSIGNED,
            event: 'ADMIN_UNASSIGNED_RIDER',
            data: { riderId: order.riderId },
            extraUpdate: { riderId: null },
        });
        if (order.pharmacyId) {
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                status: client_1.OrderStatus.ASSIGNED,
                riderId: null,
            });
        }
        return updated;
    }
    async adminAddNote(orderId, note) {
        await this.logTimeline(orderId, 'ADMIN_NOTE', { note });
        return { ok: true };
    }
    async getSettlementState(orderId) {
        const last = await this.prisma.orderTimeline.findFirst({
            where: {
                orderId,
                event: { in: ['ADMIN_SETTLED_ORDER', 'ADMIN_UNSETTLED_ORDER'] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!last)
            return { settled: false };
        return {
            settled: last.event === 'ADMIN_SETTLED_ORDER',
            lastEvent: last.event,
            at: last.createdAt,
            data: last.data ? JSON.parse(last.data) : undefined,
        };
    }
    async adminSettleOrder(orderId, adminId, opts) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const force = Boolean(opts?.force);
        if (!force) {
            const ok = order.status === client_1.OrderStatus.DELIVERED ||
                order.status === client_1.OrderStatus.PAID;
            if (!ok) {
                throw new common_1.BadRequestException(`Order cannot be settled until delivered/paid (status=${order.status}). Use force=true to override.`);
            }
        }
        const current = await this.getSettlementState(orderId);
        if (current.settled) {
            return {
                ok: true,
                orderId,
                settled: true,
                already: true,
                settledAt: current.at ?? null,
            };
        }
        const note = (opts?.note ?? '').trim();
        await this.logTimeline(orderId, 'ADMIN_SETTLED_ORDER', {
            adminId,
            note: note || undefined,
            force,
            orderStatus: order.status,
        });
        if (order.pharmacyId) {
            this.notify.create(order.pharmacyId, 'ORDER_SETTLED', `Order #${orderId} settled`, { orderId }, adminId);
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                settled: true,
            });
        }
        return { ok: true, orderId, settled: true };
    }
    async adminUnsettleOrder(orderId, adminId, opts) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        const current = await this.getSettlementState(orderId);
        if (!current.settled && current.lastEvent === 'ADMIN_UNSETTLED_ORDER') {
            return { ok: true, orderId, settled: false, already: true };
        }
        const note = (opts?.note ?? '').trim();
        await this.logTimeline(orderId, 'ADMIN_UNSETTLED_ORDER', {
            adminId,
            note: note || undefined,
            orderStatus: order.status,
        });
        if (order.pharmacyId) {
            this.notify.create(order.pharmacyId, 'ORDER_UNSETTLED', `Order #${orderId} marked as unsettled`, { orderId }, adminId);
            this.ws.notifyUser(order.pharmacyId, 'order.updated', {
                orderId,
                settled: false,
            });
        }
        return { ok: true, orderId, settled: false };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(11, (0, common_1.Inject)('ORDER_ASSIGN_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway,
        config_1.ConfigService,
        surge_service_1.SurgeService,
        geo_surge_service_1.GeoSurgeService,
        payments_service_1.PaymentsService,
        rider_payments_service_1.RiderPaymentsService,
        rider_quality_service_1.RiderQualityService,
        order_lifecycle_service_1.OrderLifecycleService,
        service_area_service_1.ServiceAreaService,
        bullmq_1.Queue])
], OrdersService);
