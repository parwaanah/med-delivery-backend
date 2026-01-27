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
var OrderLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../utils/prisma.service");
const lock_service_1 = require("../utils/lock.service");
const NEEDS_CONFIRMATION_STATUS = 'NEEDS_CONFIRMATION';
let OrderLifecycleService = OrderLifecycleService_1 = class OrderLifecycleService {
    constructor(prisma, lock) {
        this.prisma = prisma;
        this.lock = lock;
        this.logger = new common_1.Logger(OrderLifecycleService_1.name);
    }
    normalizeStatus(s) {
        if (String(s) === String(NEEDS_CONFIRMATION_STATUS))
            return NEEDS_CONFIRMATION_STATUS;
        return s;
    }
    isTerminal(s) {
        return (s === client_1.OrderStatus.CANCELED ||
            s === client_1.OrderStatus.DELIVERED ||
            s === client_1.OrderStatus.REJECTED);
    }
    canTransition(from, to) {
        const f = this.normalizeStatus(from);
        const t = this.normalizeStatus(to);
        if (f === t)
            return true;
        if (this.isTerminal(f))
            return false;
        if (f === client_1.OrderStatus.PENDING) {
            return (t === client_1.OrderStatus.ACCEPTED ||
                t === client_1.OrderStatus.REJECTED ||
                t === NEEDS_CONFIRMATION_STATUS ||
                t === client_1.OrderStatus.CANCELED);
        }
        if (f === NEEDS_CONFIRMATION_STATUS) {
            return t === client_1.OrderStatus.ACCEPTED || t === client_1.OrderStatus.CANCELED;
        }
        if (f === client_1.OrderStatus.ACCEPTED) {
            return t === client_1.OrderStatus.ASSIGNED || t === client_1.OrderStatus.CANCELED;
        }
        if (f === client_1.OrderStatus.ASSIGNED) {
            return t === client_1.OrderStatus.REACHED_PHARMACY || t === client_1.OrderStatus.CANCELED;
        }
        if (f === client_1.OrderStatus.REACHED_PHARMACY) {
            return t === client_1.OrderStatus.PICKED_UP || t === client_1.OrderStatus.CANCELED;
        }
        if (f === client_1.OrderStatus.PICKED_UP) {
            return t === client_1.OrderStatus.OUT_FOR_DELIVERY || t === client_1.OrderStatus.CANCELED;
        }
        if (f === client_1.OrderStatus.OUT_FOR_DELIVERY) {
            return t === client_1.OrderStatus.DELIVERED || t === client_1.OrderStatus.CANCELED;
        }
        if (t === client_1.OrderStatus.CANCELED)
            return true;
        return false;
    }
    async logTimeline(db, orderId, event, data) {
        try {
            await db.orderTimeline.create({
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
    async transition(input) {
        const db = input.db ?? this.prisma;
        const orderId = Number(input.orderId);
        if (!Number.isFinite(orderId))
            throw new common_1.BadRequestException('Invalid orderId');
        try {
            return await this.lock.withLock(`lock:order:${orderId}`, 5000, async () => {
                const order = await db.order.findUnique({
                    where: { id: orderId },
                    select: {
                        id: true,
                        status: true,
                        customerId: true,
                        pharmacyId: true,
                        riderId: true,
                        paymentMode: true,
                        requiresPrescription: true,
                        prescriptionId: true,
                        totalPrice: true,
                        createdAt: true,
                    },
                });
                if (!order)
                    throw new common_1.NotFoundException('Order not found');
                const current = this.normalizeStatus(order.status);
                const target = this.normalizeStatus(input.to);
                if (String(current) === String(target)) {
                    return { order, changed: false };
                }
                if (input.from &&
                    String(current) !== String(this.normalizeStatus(input.from))) {
                    throw new common_1.BadRequestException(`Invalid transition (expected ${input.from}, got ${current})`);
                }
                if (!this.canTransition(current, target)) {
                    throw new common_1.BadRequestException(`Invalid transition ${current} -> ${target}`);
                }
                const update = { status: target };
                if (input.extraUpdate && typeof input.extraUpdate === 'object') {
                    Object.assign(update, input.extraUpdate);
                }
                const res = await db.order.updateMany({
                    where: { id: orderId, status: order.status },
                    data: update,
                });
                if (!res || res.count !== 1) {
                    const after = await db.order.findUnique({
                        where: { id: orderId },
                        select: {
                            id: true,
                            status: true,
                            customerId: true,
                            pharmacyId: true,
                            riderId: true,
                        },
                    });
                    if (!after)
                        throw new common_1.NotFoundException('Order not found');
                    if (String(this.normalizeStatus(after.status)) === String(target)) {
                        return { order: after, changed: false };
                    }
                    throw new common_1.ConflictException('Order status changed; please retry');
                }
                await this.logTimeline(db, orderId, input.event, {
                    actor: { id: input.actor.id, role: input.actor.role },
                    from: String(current),
                    to: String(target),
                    ...(input.data || {}),
                });
                const updated = await db.order.findUnique({
                    where: { id: orderId },
                    include: { items: true, prescription: true },
                });
                return { order: updated, changed: true };
            }, { waitMs: 50, retries: 40 });
        }
        catch (e) {
            if (typeof e?.message === 'string' && e.message.startsWith('LOCK_BUSY:')) {
                throw new common_1.ConflictException('Order is busy; please retry');
            }
            throw e;
        }
    }
    async forceStatus(input) {
        const db = input.db ?? this.prisma;
        const orderId = Number(input.orderId);
        if (!Number.isFinite(orderId))
            throw new common_1.BadRequestException('Invalid orderId');
        try {
            return await this.lock.withLock(`lock:order:${orderId}`, 5000, async () => {
                const order = await db.order.findUnique({
                    where: { id: orderId },
                    select: {
                        id: true,
                        status: true,
                        customerId: true,
                        pharmacyId: true,
                        riderId: true,
                    },
                });
                if (!order)
                    throw new common_1.NotFoundException('Order not found');
                const current = this.normalizeStatus(order.status);
                const target = this.normalizeStatus(input.to);
                if (String(current) === String(target)) {
                    return { order, changed: false };
                }
                const update = { status: target };
                if (input.extraUpdate &&
                    typeof input.extraUpdate === 'object') {
                    Object.assign(update, input.extraUpdate);
                }
                const res = await db.order.updateMany({
                    where: { id: orderId, status: order.status },
                    data: update,
                });
                if (!res || res.count !== 1) {
                    const after = await db.order.findUnique({
                        where: { id: orderId },
                        select: {
                            id: true,
                            status: true,
                            customerId: true,
                            pharmacyId: true,
                            riderId: true,
                        },
                    });
                    if (!after)
                        throw new common_1.NotFoundException('Order not found');
                    if (String(this.normalizeStatus(after.status)) === String(target)) {
                        return { order: after, changed: false };
                    }
                    throw new common_1.ConflictException('Order status changed; please retry');
                }
                await this.logTimeline(db, orderId, input.event, {
                    actor: { id: input.actor.id, role: input.actor.role },
                    from: String(current),
                    to: String(target),
                    force: true,
                    ...(input.data || {}),
                });
                const updated = await db.order.findUnique({
                    where: { id: orderId },
                    include: { items: true, prescription: true },
                });
                return { order: updated, changed: true };
            }, { waitMs: 50, retries: 40 });
        }
        catch (e) {
            if (typeof e?.message === 'string' && e.message.startsWith('LOCK_BUSY:')) {
                throw new common_1.ConflictException('Order is busy; please retry');
            }
            throw e;
        }
    }
};
exports.OrderLifecycleService = OrderLifecycleService;
exports.OrderLifecycleService = OrderLifecycleService = OrderLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        lock_service_1.LockService])
], OrderLifecycleService);
