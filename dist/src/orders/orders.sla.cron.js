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
var OrdersSlaCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersSlaCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const client_1 = require("@prisma/client");
let OrdersSlaCron = OrdersSlaCron_1 = class OrdersSlaCron {
    constructor(prisma, notify, ws, config) {
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.config = config;
        this.logger = new common_1.Logger(OrdersSlaCron_1.name);
    }
    slaMinutes() {
        const raw = this.config.get('PHARMACY_ACCEPT_SLA_MINUTES') ??
            process.env.PHARMACY_ACCEPT_SLA_MINUTES ??
            '10';
        const n = Number(raw);
        if (!Number.isFinite(n))
            return 10;
        return Math.min(Math.max(Math.floor(n), 1), 180);
    }
    async handlePharmacyAcceptSla() {
        if (process.env.DISABLE_SLA === '1')
            return;
        const minutes = this.slaMinutes();
        const cutoff = new Date(Date.now() - minutes * 60_000);
        const overdue = await this.prisma.order.findMany({
            where: {
                status: client_1.OrderStatus.PENDING,
                deletedAt: null,
                createdAt: { lt: cutoff },
            },
            select: {
                id: true,
                customerId: true,
                pharmacyId: true,
                createdAt: true,
            },
            take: 200,
        });
        if (!overdue.length)
            return;
        for (const o of overdue) {
            try {
                const res = await this.prisma.order.updateMany({
                    where: { id: o.id, status: client_1.OrderStatus.PENDING },
                    data: { status: client_1.OrderStatus.REJECTED },
                });
                if (!res || res.count !== 1)
                    continue;
                const ageSec = Math.max(0, Math.floor((Date.now() - o.createdAt.getTime()) / 1000));
                await this.prisma.orderTimeline.create({
                    data: {
                        orderId: o.id,
                        event: 'PHARMACY_SLA_BREACHED',
                        data: JSON.stringify({
                            pharmacyId: o.pharmacyId,
                            slaMinutes: minutes,
                            ageSec,
                            auto: true,
                        }),
                    },
                });
                await this.prisma.auditLog.create({
                    data: {
                        userId: o.pharmacyId,
                        action: 'PHARMACY_SLA_BREACH',
                        resource: `order:${o.id}`,
                        meta: { orderId: o.id, slaMinutes: minutes, ageSec },
                    },
                });
                this.notify.create(o.customerId, 'ORDER_REJECTED', `Order #${o.id} expired (pharmacy did not respond in time)`, { orderId: o.id, slaMinutes: minutes }, o.pharmacyId);
                this.notify.create(o.pharmacyId, 'SLA_BREACH', `SLA breach: Order #${o.id} auto-rejected after ${minutes} minutes`, { orderId: o.id, slaMinutes: minutes, ageSec });
                this.ws.notifyUser(o.customerId, 'order_status_update', {
                    orderId: o.id,
                    stage: client_1.OrderStatus.REJECTED,
                    reason: 'SLA_BREACHED',
                });
                this.ws.notifyUser(o.pharmacyId, 'order.updated', {
                    orderId: o.id,
                    status: client_1.OrderStatus.REJECTED,
                    reason: 'SLA_BREACHED',
                });
                this.ws.notifyAdmins?.('order.sla_breached', {
                    orderId: o.id,
                    pharmacyId: o.pharmacyId,
                    ageSec,
                    slaMinutes: minutes,
                });
            }
            catch (e) {
                this.logger.warn(`SLA breach processing failed for order ${o.id}: ${e?.message || e}`);
            }
        }
        this.logger.debug(`SLA check processed ${overdue.length} overdue orders`);
    }
};
exports.OrdersSlaCron = OrdersSlaCron;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrdersSlaCron.prototype, "handlePharmacyAcceptSla", null);
exports.OrdersSlaCron = OrdersSlaCron = OrdersSlaCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway,
        config_1.ConfigService])
], OrdersSlaCron);
