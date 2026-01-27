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
var OrderOfferExpiryCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderOfferExpiryCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../utils/prisma.service");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
const common_2 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let OrderOfferExpiryCron = OrderOfferExpiryCron_1 = class OrderOfferExpiryCron {
    constructor(prisma, config, orderAssignQueue) {
        this.prisma = prisma;
        this.config = config;
        this.orderAssignQueue = orderAssignQueue;
        this.logger = new common_1.Logger(OrderOfferExpiryCron_1.name);
    }
    takeLimit() {
        const n = Number(this.config.get('OFFER_EXPIRY_SCAN_LIMIT') || 200);
        if (!Number.isFinite(n))
            return 200;
        return Math.min(Math.max(Math.floor(n), 20), 1000);
    }
    async expireOffers() {
        const now = new Date();
        const offers = await this.prisma.orderOffer.findMany({
            where: {
                offeredTo: 'RIDER',
                status: 'PENDING',
                expiresAt: { lt: now },
            },
            select: { id: true, orderId: true },
            take: this.takeLimit(),
            orderBy: { expiresAt: 'asc' },
        });
        if (!offers.length)
            return;
        const orderIds = Array.from(new Set(offers.map((o) => Number(o.orderId))));
        await this.prisma.orderOffer.updateMany({
            where: { id: { in: offers.map((o) => o.id) } },
            data: {
                status: 'EXPIRED',
                respondedAt: now,
                rejectReason: 'TTL_EXPIRED',
            },
        });
        for (const orderId of orderIds) {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                select: { id: true, riderId: true, status: true },
            });
            if (!order || order.riderId)
                continue;
            if (order.status !== client_1.OrderStatus.ASSIGNED) {
                continue;
            }
            const pending = await this.prisma.orderOffer.count({
                where: {
                    orderId,
                    offeredTo: 'RIDER',
                    status: 'PENDING',
                    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                },
            });
            if (pending > 0)
                continue;
            const delay = Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
            await this.orderAssignQueue.add('rider_escalation', { orderId }, { delay });
        }
        this.logger.debug(`Expired ${offers.length} rider offers`);
    }
};
exports.OrderOfferExpiryCron = OrderOfferExpiryCron;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OrderOfferExpiryCron.prototype, "expireOffers", null);
exports.OrderOfferExpiryCron = OrderOfferExpiryCron = OrderOfferExpiryCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)('ORDER_ASSIGN_QUEUE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        bullmq_1.Queue])
], OrderOfferExpiryCron);
