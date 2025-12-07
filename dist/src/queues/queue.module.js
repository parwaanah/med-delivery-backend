"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const config_1 = require("@nestjs/config");
const order_assign_worker_1 = require("./order-assign.worker");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const escalation_service_1 = require("../admin/escalation.service");
const ws_module_1 = require("../ws/ws.module");
const orders_module_1 = require("../orders/orders.module");
const admin_module_1 = require("../admin/admin.module");
const geo_surge_module_1 = require("../geosurge/geo-surge.module");
const surge_module_1 = require("../surge/surge.module");
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => orders_module_1.OrdersModule),
            (0, common_1.forwardRef)(() => admin_module_1.AdminModule),
            ws_module_1.WsModule,
            geo_surge_module_1.GeoSurgeModule,
            surge_module_1.SurgeModule,
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        host: config.get('REDIS_HOST') || 'redis',
                        port: Number(config.get('REDIS_PORT') ?? 6379),
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({
                name: 'order_assign',
            }),
        ],
        providers: [
            order_assign_worker_1.OrderAssignWorker,
            prisma_service_1.PrismaService,
            notification_service_1.NotificationService,
            escalation_service_1.EscalationService,
            {
                provide: 'ORDER_ASSIGN_QUEUE',
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    return new bullmq_2.Queue('order_assign', {
                        connection: {
                            host: config.get('REDIS_HOST') || 'redis',
                            port: Number(config.get('REDIS_PORT') ?? 6379),
                        },
                    });
                },
            },
        ],
        exports: ['ORDER_ASSIGN_QUEUE', order_assign_worker_1.OrderAssignWorker],
    })
], QueueModule);
