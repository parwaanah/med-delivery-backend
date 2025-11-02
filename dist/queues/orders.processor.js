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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let OrdersProcessor = class OrdersProcessor {
    constructor(config, prisma, notify, ws) {
        this.config = config;
        this.prisma = prisma;
        this.notify = notify;
        this.ws = ws;
    }
    onModuleInit() {
        const redisUrl = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        this.worker = new bullmq_1.Worker('order_assign', async (job) => {
            const { orderId } = job.data;
            const order = await this.prisma.order.findUnique({ where: { id: orderId } });
            if (!order)
                return;
            if (!order.riderId && (order.status === 'ACCEPTED' || order.status === 'ASSIGNED')) {
                const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
                if (admin) {
                    await this.notify.create(admin.id, 'ORDER_ESCALATION', `No rider accepted order ${orderId} within timeframe`, { orderId });
                    this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
                }
            }
        }, { connection: redisUrl });
    }
};
exports.OrdersProcessor = OrdersProcessor;
exports.OrdersProcessor = OrdersProcessor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        ws_gateway_1.WsGateway])
], OrdersProcessor);
