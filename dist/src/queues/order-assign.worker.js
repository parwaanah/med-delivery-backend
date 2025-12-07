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
    onModuleInit() {
        const redisUrl = this.config.get('REDIS_URL') ||
            `redis://redis:${this.config.get('REDIS_PORT') ?? 6379}`;
        const queueName = this.config.get('ORDER_ASSIGN_QUEUE_NAME') || 'order_assign';
        this.redisClient = new ioredis_1.default(redisUrl, {
            enableReadyCheck: true,
            maxRetriesPerRequest: null,
        });
        this.worker = new bullmq_1.Worker(queueName, async (job) => {
            try {
                this.logger.log(`Processing job ${job.id} (${job.name}) data=${JSON.stringify(job.data)}`);
                if (job.name === 'rider_escalation') {
                    const { orderId } = job.data;
                    if (!orderId)
                        return;
                    const order = await this.prisma.order.findUnique({
                        where: { id: Number(orderId) },
                        select: { id: true, status: true, riderId: true, pharmacyId: true, customerId: true },
                    });
                    if (!order) {
                        this.logger.warn(`Order ${orderId} not found — skipping`);
                        return;
                    }
                    if (!['PENDING', 'ACCEPTED'].includes(String(order.status))) {
                        this.logger.log(`Order ${orderId} status=${order.status} — skipping`);
                        return;
                    }
                    if (order.riderId) {
                        this.logger.log(`Order ${orderId} already has rider ${order.riderId}`);
                        return;
                    }
                    const autoAssign = String(this.config.get('AUTO_ASSIGN_RIDER') ?? 'false').toLowerCase() ===
                        'true';
                    const candidates = await this.esc.findCandidatesForOrder(Number(orderId), Number(this.config.get('RIDER_SEARCH_KM') || 5), 20);
                    if (autoAssign && candidates?.length) {
                        for (const c of candidates) {
                            const riderId = Number(c.riderId);
                            if (!riderId || isNaN(riderId))
                                continue;
                            try {
                                const result = await this.prisma.$transaction(async (tx) => {
                                    const rider = await tx.user.findUnique({
                                        where: { id: riderId },
                                        select: { id: true, status: true },
                                    });
                                    if (!rider || rider.status !== 'AVAILABLE')
                                        return null;
                                    const ord = await tx.order.findUnique({
                                        where: { id: Number(orderId) },
                                        select: { riderId: true, customerId: true },
                                    });
                                    if (!ord || ord.riderId)
                                        return null;
                                    await tx.order.update({
                                        where: { id: Number(orderId) },
                                        data: { riderId, status: client_1.OrderStatus.OUT_FOR_DELIVERY },
                                    });
                                    await tx.user.update({
                                        where: { id: riderId },
                                        data: { status: 'BUSY' },
                                    });
                                    return {
                                        riderId,
                                        orderId: Number(orderId),
                                        customerId: ord.customerId,
                                    };
                                });
                                if (result) {
                                    this.notify.create(result.riderId, 'ORDER_ASSIGNED', `You were assigned to order #${result.orderId}`, { orderId: result.orderId });
                                    this.ws.notifyUser(result.riderId, 'order_assigned', {
                                        orderId: result.orderId,
                                    });
                                    this.notify.create(result.customerId, 'ORDER_OUT_FOR_DELIVERY', `Your order #${result.orderId} is out for delivery`, { orderId: result.orderId });
                                    this.ws.notifyUser(result.customerId, 'order_status_update', {
                                        orderId: result.orderId,
                                        stage: 'OUT_FOR_DELIVERY',
                                    });
                                    this.logger.log(`Auto-assigned rider ${result.riderId} -> order ${result.orderId}`);
                                    return;
                                }
                            }
                            catch (err) {
                                this.logger.warn(`Auto-assign failed rider=${riderId} order=${orderId}: ${err?.message ?? err}`);
                            }
                        }
                    }
                    const admins = await this.prisma.user.findMany({
                        where: { role: client_1.UserRole.ADMIN },
                        select: { id: true },
                    });
                    for (const a of admins) {
                        await this.notify.create(a.id, 'ORDER_ESCALATION', `No rider accepted order #${orderId}`, { orderId });
                        this.ws.notifyUser(a.id, 'order_escalation', { orderId });
                    }
                    this.logger.warn(`Escalation sent for order ${orderId}`);
                }
            }
            catch (err) {
                this.logger.error(`Job ${job.id} (${job.name}) failed: ${err?.message ?? err}`);
                throw err;
            }
        }, { connection: this.redisClient });
        this.worker.on('completed', (job) => this.logger.log(`Escalation job completed ${job.id} (${job.name})`));
        this.worker.on('failed', (job, err) => this.logger.warn(`Escalation job failed ${job?.id}: ${err?.message}`));
        this.logger.log(`✅ OrderAssignWorker started (queue=${queueName})`);
    }
    async onModuleDestroy() {
        await this.worker.close().catch(() => { });
        await this.redisClient.quit().catch(() => { });
        this.logger.log('🛑 OrderAssignWorker stopped');
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
