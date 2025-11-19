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
var OrdersQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersQueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@nestjs/config");
let OrdersQueueService = OrdersQueueService_1 = class OrdersQueueService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(OrdersQueueService_1.name);
        const redisUrl = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        const queueName = this.config.get('ORDER_ASSIGN_QUEUE_NAME') || 'order_assign';
        const conn = new ioredis_1.default(redisUrl, { enableReadyCheck: true, maxRetriesPerRequest: null });
        this.queue = new bullmq_1.Queue(queueName, { connection: conn });
    }
    async addRiderEscalation(orderId, delayMs) {
        try {
            await this.queue.add('rider_escalation', { orderId }, { removeOnComplete: true, removeOnFail: false, delay: delayMs ?? 0 });
            this.logger.log(`Enqueued rider_escalation for order ${orderId} delay=${delayMs ?? 0}ms`);
        }
        catch (err) {
            this.logger.warn('Failed to enqueue rider_escalation', err?.message ?? err);
            throw err;
        }
    }
};
exports.OrdersQueueService = OrdersQueueService;
exports.OrdersQueueService = OrdersQueueService = OrdersQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OrdersQueueService);
