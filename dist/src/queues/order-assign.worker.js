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
        const queueName = this.config.get('ORDER_ASSIGN_QUEUE_NAME') ||
            'order_assign';
        this.redisClient = new ioredis_1.default(redisUrl, {
            enableReadyCheck: true,
            maxRetriesPerRequest: null,
        });
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
                },
            });
            if (!order)
                return;
            if (order.riderId ||
                (order.status !== client_1.OrderStatus.PENDING &&
                    order.status !== client_1.OrderStatus.ACCEPTED)) {
                return;
            }
            const candidates = await this.esc.findCandidatesForOrder(orderId);
            for (const c of candidates) {
                const riderId = Number(c.riderId);
                if (!riderId)
                    continue;
                const assigned = await this.prisma.$transaction(async (tx) => {
                    const fresh = await tx.order.findUnique({
                        where: { id: orderId },
                        select: { riderId: true },
                    });
                    if (fresh?.riderId)
                        return null;
                    await tx.order.update({
                        where: { id: orderId },
                        data: {
                            riderId,
                            status: client_1.OrderStatus.OUT_FOR_DELIVERY,
                        },
                    });
                    await tx.user.update({
                        where: { id: riderId },
                        data: { status: 'BUSY' },
                    });
                    return riderId;
                });
                if (assigned) {
                    this.notify.create(assigned, 'ORDER_ASSIGNED', `Order #${orderId} assigned`, { orderId });
                    this.ws.notifyUser(assigned, 'order_assigned', {
                        orderId,
                    });
                    this.ws.notifyUser(order.customerId, 'order_status_update', {
                        orderId,
                        stage: client_1.OrderStatus.OUT_FOR_DELIVERY,
                    });
                    this.logger.log(`Auto-assigned rider ${assigned} → order ${orderId}`);
                    return;
                }
            }
            const admins = await this.prisma.user.findMany({
                where: { role: client_1.UserRole.ADMIN },
                select: { id: true },
            });
            for (const admin of admins) {
                this.notify.create(admin.id, 'ORDER_ESCALATION', `Order #${orderId} requires manual assignment`, { orderId });
                this.ws.notifyUser(admin.id, 'order_escalation', {
                    orderId,
                });
            }
            this.logger.warn(`Order ${orderId} escalated to admins`);
        }, { connection: this.redisClient });
        this.logger.log('✅ OrderAssignWorker running');
    }
    async onModuleDestroy() {
        await this.worker?.close().catch(() => { });
        await this.redisClient?.quit().catch(() => { });
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
