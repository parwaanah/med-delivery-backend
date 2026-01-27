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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OrderAssignWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderAssignWorker = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const escalation_service_1 = require("../admin/escalation.service");
const client_1 = require("@prisma/client");
let OrderAssignWorker = OrderAssignWorker_1 = class OrderAssignWorker {
    constructor(config, prisma, notify, ws, esc) {
        this.config = config;
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.esc = esc;
        this.logger = new common_1.Logger(OrderAssignWorker_1.name);
    }
    offerLockKey(orderId) {
        return `order:offer_lock:${orderId}`;
    }
    offerRoundKey(orderId) {
        return `order:offer_round:${orderId}`;
    }
    offerTtlSec() {
        const n = Number(this.config.get('RIDER_OFFER_TTL_SEC') ||
            process.env.RIDER_OFFER_TTL_SEC ||
            30);
        if (!Number.isFinite(n))
            return 30;
        return Math.min(Math.max(Math.floor(n), 10), 300);
    }
    offerBatchSize() {
        const n = Number(this.config.get('RIDER_OFFER_BATCH') ||
            process.env.RIDER_OFFER_BATCH ||
            5);
        if (!Number.isFinite(n))
            return 5;
        return Math.min(Math.max(Math.floor(n), 1), 20);
    }
    maxRounds() {
        const n = Number(this.config.get('RIDER_OFFER_MAX_ROUNDS') ||
            process.env.RIDER_OFFER_MAX_ROUNDS ||
            3);
        if (!Number.isFinite(n))
            return 3;
        return Math.min(Math.max(Math.floor(n), 1), 10);
    }
    onModuleInit() {
        const redisUrl = this.config.get('REDIS_URL') ||
            `redis://redis:${this.config.get('REDIS_PORT') ?? 6379}`;
        const queueName = this.config.get('ORDER_ASSIGN_QUEUE_NAME') || 'order_assign';
        this.redisClient = new ioredis_1.default(redisUrl, {
            enableReadyCheck: true,
            maxRetriesPerRequest: null,
        });
        this.dlq = new bullmq_1.Queue('dead_letter', { connection: this.redisClient });
        this.worker = new bullmq_1.Worker(queueName, async (job) => {
            if (job.name !== 'rider_escalation')
                return;
            const orderId = Number(job.data?.orderId);
            if (!orderId)
                return;
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                select: {
                    status: true,
                    riderId: true,
                    customerId: true,
                    pharmacyId: true,
                },
            });
            if (!order)
                return;
            if (order.riderId ||
                order.status !== client_1.OrderStatus.ASSIGNED) {
                return;
            }
            const ttlSec = this.offerTtlSec();
            const lockOk = await this.redisClient.set(this.offerLockKey(orderId), String(Date.now()), 'EX', ttlSec, 'NX');
            if (!lockOk)
                return;
            const round = await this.redisClient.incr(this.offerRoundKey(orderId));
            try {
                await this.redisClient.expire(this.offerRoundKey(orderId), 24 * 60 * 60);
            }
            catch { }
            if (round > this.maxRounds()) {
                const admins = await this.prisma.user.findMany({
                    where: { role: client_1.UserRole.ADMIN },
                    select: { id: true },
                });
                for (const admin of admins) {
                    this.notify.create(admin.id, 'ORDER_ESCALATION', `Order #${orderId} requires manual rider assignment`, { orderId, reason: 'NO_RIDER_ACCEPT', rounds: round });
                    this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
                }
                this.ws.notifyAdmins('order.escalated', {
                    orderId,
                    reason: 'NO_RIDER_ACCEPT',
                    rounds: round,
                });
                return;
            }
            const candidates = await this.esc.findCandidatesForOrder(orderId);
            const batch = candidates.slice(0, this.offerBatchSize());
            const expiresAt = new Date(Date.now() + ttlSec * 1000);
            for (const c of batch) {
                const riderId = Number(c.riderId);
                if (!riderId)
                    continue;
                await this.prisma.orderOffer.create({
                    data: {
                        orderId,
                        pharmacyId: order.pharmacyId,
                        riderId,
                        offeredTo: 'RIDER',
                        status: 'PENDING',
                        score: Number(c.score ?? 0),
                        expiresAt,
                    },
                });
                this.notify.create(riderId, 'ORDER_OFFER', `New delivery offer for order #${orderId}`, { orderId, expiresAt, round, score: c.score ?? null });
                this.ws.notifyUser(riderId, 'order.offer', {
                    orderId,
                    expiresAt,
                    round,
                    score: c.score ?? null,
                });
            }
            if (batch.length === 0) {
                const admins = await this.prisma.user.findMany({
                    where: { role: client_1.UserRole.ADMIN },
                    select: { id: true },
                });
                for (const admin of admins) {
                    this.notify.create(admin.id, 'ORDER_ESCALATION', `Order #${orderId} requires manual assignment`, { orderId, reason: 'NO_CANDIDATES', round });
                    this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
                }
                this.ws.notifyAdmins('order.escalated', {
                    orderId,
                    reason: 'NO_CANDIDATES',
                    round,
                });
                this.logger.warn(`Order ${orderId} escalated to admins`);
            }
        }, { connection: this.redisClient });
        this.worker.on('failed', (job, err) => (async () => {
            try {
                await this.dlq.add('dead_letter', {
                    queue: queueName,
                    jobId: job?.id ?? null,
                    name: job?.name ?? null,
                    data: job?.data ?? null,
                    error: err?.message ?? String(err),
                    at: new Date().toISOString(),
                }, { removeOnComplete: true, removeOnFail: false });
            }
            catch { }
        })());
        this.logger.log('OrderAssignWorker running (offer engine)');
    }
    async onModuleDestroy() {
        await this.worker?.close().catch(() => { });
        await this.dlq?.close().catch(() => { });
        await this.redisClient?.quit().catch(() => { });
        this.logger.log('OrderAssignWorker stopped');
    }
};
exports.OrderAssignWorker = OrderAssignWorker;
exports.OrderAssignWorker = OrderAssignWorker = OrderAssignWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway,
        escalation_service_1.EscalationService])
], OrderAssignWorker);
