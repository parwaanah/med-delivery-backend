"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModule = void 0;
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const orders_controller_1 = require("./orders.controller");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const payments_module_1 = require("../payments/payments.module");
const surge_module_1 = require("../surge/surge.module");
const geo_surge_module_1 = require("../geosurge/geo-surge.module");
const ws_module_1 = require("../ws/ws.module");
const queue_module_1 = require("../queues/queue.module");
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => queue_module_1.QueueModule),
            payments_module_1.PaymentsModule,
            surge_module_1.SurgeModule,
            geo_surge_module_1.GeoSurgeModule,
            ws_module_1.WsModule,
        ],
        controllers: [orders_controller_1.OrdersController],
        providers: [orders_service_1.OrdersService, prisma_service_1.PrismaService, notification_service_1.NotificationService],
        exports: [orders_service_1.OrdersService],
    })
], OrdersModule);
