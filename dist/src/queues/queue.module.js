"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const bullmq_1 = require("bullmq");
const orders_processor_1 = require("./orders.processor");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: 'REDIS',
                useFactory: (config) => {
                    const redisUrl = config.get('REDIS_URL') ?? 'redis://127.0.0.1:6379';
                    return new ioredis_1.default(redisUrl, {
                        enableReadyCheck: true,
                    });
                },
                inject: [config_1.ConfigService],
            },
            {
                provide: 'ORDER_ASSIGN_QUEUE',
                useFactory: (config) => {
                    const redisUrl = config.get('REDIS_URL') ?? 'redis://127.0.0.1:6379';
                    const bullConn = new ioredis_1.default(redisUrl, {
                        enableReadyCheck: true,
                        maxRetriesPerRequest: null,
                    });
                    return new bullmq_1.Queue('order_assign', { connection: bullConn });
                },
                inject: [config_1.ConfigService],
            },
            prisma_service_1.PrismaService,
            notification_service_1.NotificationService,
            ws_gateway_1.WsGateway,
            orders_processor_1.OrdersProcessor,
        ],
        exports: ['ORDER_ASSIGN_QUEUE', 'REDIS'],
    })
], QueueModule);
