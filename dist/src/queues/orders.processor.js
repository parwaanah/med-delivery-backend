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
var OrdersProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let OrdersProcessor = OrdersProcessor_1 = class OrdersProcessor {
    constructor(config, prisma, notify, ws) {
        this.config = config;
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
        this.logger = new common_1.Logger(OrdersProcessor_1.name);
    }
    onModuleInit() {
        const redisUrl = this.config.get('REDIS_URL') || 'redis://redis:6379';
        this.redisClient = new ioredis_1.default(redisUrl, {
            enableReadyCheck: true,
            maxRetriesPerRequest: null,
        });
        this.dlq = new bullmq_1.Queue('dead_letter', { connection: this.redisClient });
        this.worker = new bullmq_1.Worker('order_assign', async (job) => {
            try {
                const { orderId } = job.data;
                if (!orderId)
                    return;
                const order = await this.prisma.order.findUnique({
                    where: { id: orderId },
                    select: { id: true, riderId: true, status: true, pharmacyId: true, customerId: true }
                });
                if (!order)
                    return;
                if (!order.riderId && order.status === 'PENDING') {
                    const admin = await this.prisma.user.findFirst({
                        where: { role: 'ADMIN' },
                        select: { id: true }
                    });
                    if (admin) {
                        await this.notify.create(admin.id, 'ORDER_ESCALATION', `⚠ No rider accepted order #${orderId} within the expected time.`, { orderId });
                        this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
                    }
                    this.logger.warn(`⏰ Escalation triggered for order ${orderId} — no rider accepted.`);
                }
            }
            catch (err) {
                this.logger.error('Worker job failed', err);
            }
        }, {
            connection: this.redisClient,
        });
        this.worker.on('completed', (job) => this.logger.log(`Order escalation check completed for job ${job.id}`));
        this.worker.on('failed', (job, err) => (async () => {
            this.logger.warn(`Escalation job failed ${job?.id}: ${err?.message}`);
            try {
                await this.dlq.add('dead_letter', {
                    queue: 'order_assign',
                    jobId: job?.id ?? null,
                    name: job?.name ?? null,
                    data: job?.data ?? null,
                    error: err?.message ?? String(err),
                    at: new Date().toISOString(),
                }, { removeOnComplete: true, removeOnFail: false });
            }
            catch { }
        })());
        this.logger.log('✅ OrdersProcessor worker started (order_assign)');
    }
    async onModuleDestroy() {
        try {
            await this.worker.close();
        }
        catch { }
        try {
            await this.dlq?.close();
        }
        catch { }
        try {
            await this.redisClient.quit();
        }
        catch { }
    }
};
exports.OrdersProcessor = OrdersProcessor;
exports.OrdersProcessor = OrdersProcessor = OrdersProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway])
], OrdersProcessor);
