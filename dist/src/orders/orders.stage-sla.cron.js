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
var OrdersStageSlaCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersStageSlaCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../utils/prisma.service");
const redis_service_1 = require("../utils/redis.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const client_1 = require("@prisma/client");
let OrdersStageSlaCron = OrdersStageSlaCron_1 = class OrdersStageSlaCron {
    constructor(prisma, redis, ws, config) {
        this.prisma = prisma;
        this.redis = redis;
        this.ws = ws;
        this.config = config;
        this.logger = new common_1.Logger(OrdersStageSlaCron_1.name);
    }
    minutes(key, def, min = 1, max = 24 * 60) {
        const raw = this.config.get(key) ?? process.env[key];
        const n = Number(raw ?? def);
        if (!Number.isFinite(n))
            return def;
        return Math.min(Math.max(Math.floor(n), min), max);
    }
    breachKey(orderId, stage) {
        return `order:sla_stage:${orderId}:${String(stage)}`;
    }
    async oncePerHour(orderId, stage) {
        try {
            const ok = await this.redis.client.set(this.breachKey(orderId, stage), String(Date.now()), { NX: true, EX: 60 * 60 });
            return !!ok;
        }
        catch {
            return true;
        }
    }
    async recordBreach(order, stage, minutes, since) {
        const ageSec = Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
        await this.prisma.orderTimeline.create({
            data: {
                orderId: order.id,
                event: 'STAGE_SLA_BREACHED',
                data: JSON.stringify({
                    stage,
                    minutes,
                    ageSec,
                    riderId: order.riderId ?? null,
                    pharmacyId: order.pharmacyId ?? null,
                }),
            },
        });
        this.ws.notifyAdmins('order.stage_sla_breached', {
            orderId: order.id,
            stage,
            minutes,
            ageSec,
            riderId: order.riderId ?? null,
            pharmacyId: order.pharmacyId ?? null,
        });
    }
    async handleStageSlas() {
        if (process.env.DISABLE_SLA === '1')
            return;
        const reachMin = this.minutes('RIDER_REACH_PHARMACY_SLA_MINUTES', 15, 1, 180);
        const handoverMin = this.minutes('PHARMACY_HANDOVER_SLA_MINUTES', 10, 1, 180);
        const startDeliveryMin = this.minutes('RIDER_START_DELIVERY_SLA_MINUTES', 10, 1, 180);
        const deliverMin = this.minutes('RIDER_DELIVER_SLA_MINUTES', 60, 5, 24 * 60);
        const now = Date.now();
        const cutoffReach = new Date(now - reachMin * 60_000);
        const cutoffHandover = new Date(now - handoverMin * 60_000);
        const cutoffStart = new Date(now - startDeliveryMin * 60_000);
        const cutoffDeliver = new Date(now - deliverMin * 60_000);
        const reachOverdue = await this.prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.ASSIGNED,
                riderId: { not: null },
                riderAssignedAt: { lt: cutoffReach },
                deletedAt: null,
            },
            select: { id: true, riderId: true, pharmacyId: true, riderAssignedAt: true },
            take: 200,
        });
        for (const o of reachOverdue) {
            if (!(await this.oncePerHour(o.id, client_1.OrderStatus.ASSIGNED)))
                continue;
            try {
                await this.recordBreach(o, client_1.OrderStatus.ASSIGNED, reachMin, o.riderAssignedAt);
            }
            catch (e) {
                this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
            }
        }
        const handoverOverdue = await this.prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.REACHED_PHARMACY,
                reachedPharmacyAt: { lt: cutoffHandover },
                deletedAt: null,
            },
            select: { id: true, riderId: true, pharmacyId: true, reachedPharmacyAt: true },
            take: 200,
        });
        for (const o of handoverOverdue) {
            if (!(await this.oncePerHour(o.id, client_1.OrderStatus.REACHED_PHARMACY)))
                continue;
            try {
                await this.recordBreach(o, client_1.OrderStatus.REACHED_PHARMACY, handoverMin, o.reachedPharmacyAt);
            }
            catch (e) {
                this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
            }
        }
        const startOverdue = await this.prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.PICKED_UP,
                pickedUpAt: { lt: cutoffStart },
                deletedAt: null,
            },
            select: { id: true, riderId: true, pharmacyId: true, pickedUpAt: true },
            take: 200,
        });
        for (const o of startOverdue) {
            if (!(await this.oncePerHour(o.id, client_1.OrderStatus.PICKED_UP)))
                continue;
            try {
                await this.recordBreach(o, client_1.OrderStatus.PICKED_UP, startDeliveryMin, o.pickedUpAt);
            }
            catch (e) {
                this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
            }
        }
        const deliverOverdue = await this.prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.OUT_FOR_DELIVERY,
                outForDeliveryAt: { lt: cutoffDeliver },
                deletedAt: null,
            },
            select: { id: true, riderId: true, pharmacyId: true, outForDeliveryAt: true },
            take: 200,
        });
        for (const o of deliverOverdue) {
            if (!(await this.oncePerHour(o.id, client_1.OrderStatus.OUT_FOR_DELIVERY)))
                continue;
            try {
                await this.recordBreach(o, client_1.OrderStatus.OUT_FOR_DELIVERY, deliverMin, o.outForDeliveryAt);
            }
            catch (e) {
                this.logger.warn(`Stage SLA breach log failed for order ${o.id}: ${e?.message || e}`);
            }
        }
        const total = reachOverdue.length +
            handoverOverdue.length +
            startOverdue.length +
            deliverOverdue.length;
        if (total > 0)
            this.logger.debug(`Stage SLA scan found ${total} overdue orders`);
    }
};
exports.OrdersStageSlaCron = OrdersStageSlaCron;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersStageSlaCron.prototype, "handleStageSlas", null);
exports.OrdersStageSlaCron = OrdersStageSlaCron = OrdersStageSlaCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        ws_gateway_1.WsGateway,
        config_1.ConfigService])
], OrdersStageSlaCron);
