"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const prisma_service_1 = require("./utils/prisma.service");
const pharmacies_module_1 = require("./pharmacies/pharmacies.module");
const riders_module_1 = require("./riders/riders.module");
const orders_module_1 = require("./orders/orders.module");
const queue_module_1 = require("./queues/queue.module");
const ws_gateway_1 = require("./ws/ws.gateway");
const notification_service_1 = require("./utils/notification.service");
const request_logger_middleware_1 = require("./common/middleware/request-logger.middleware");
const global_logger_service_1 = require("./common/logger/global-logger.service");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(request_logger_middleware_1.RequestLoggerMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [
                    {
                        ttl: 60,
                        limit: 30,
                    },
                ],
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            pharmacies_module_1.PharmaciesModule,
            riders_module_1.RidersModule,
            orders_module_1.OrdersModule,
            queue_module_1.QueueModule,
        ],
        providers: [prisma_service_1.PrismaService, ws_gateway_1.WsGateway, notification_service_1.NotificationService, global_logger_service_1.GlobalLogger],
    })
], AppModule);
