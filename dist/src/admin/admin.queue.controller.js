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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminQueueController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const public_decorator_1 = require("../common/decorators/public.decorator");
const config_1 = require("@nestjs/config");
let AdminQueueController = class AdminQueueController {
    constructor(config) {
        this.config = config;
        this.queues = {};
        const redisUrl = this.config.get('REDIS_URL') || 'redis://redis:6379';
        this.redis = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
        this.queues = {
            notifications: new bullmq_1.Queue('notifications', { connection: this.redis }),
            orders: new bullmq_1.Queue('orders', { connection: this.redis }),
            order_assign: new bullmq_1.Queue('order_assign', { connection: this.redis }),
            dead_letter: new bullmq_1.Queue('dead_letter', { connection: this.redis }),
        };
    }
    async getQueueStatus() {
        const result = {};
        for (const [name, q] of Object.entries(this.queues)) {
            try {
                const c = await q.getJobCounts();
                result[name] = {
                    active: c.active ?? 0,
                    waiting: c.waiting ?? 0,
                    completed: c.completed ?? 0,
                    failed: c.failed ?? 0,
                    delayed: c.delayed ?? 0,
                };
            }
            catch (err) {
                result[name] = { error: err.message };
            }
        }
        return { timestamp: new Date().toISOString(), queues: result };
    }
};
exports.AdminQueueController = AdminQueueController;
__decorate([
    (0, common_1.Get)('status'),
    (0, public_decorator_1.Public)(),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminQueueController.prototype, "getQueueStatus", null);
exports.AdminQueueController = AdminQueueController = __decorate([
    (0, common_1.Controller)('admin/queue'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AdminQueueController);
