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
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const pharmacies_module_1 = require("./pharmacies/pharmacies.module");
const riders_module_1 = require("./riders/riders.module");
const orders_module_1 = require("./orders/orders.module");
const queue_module_1 = require("./queues/queue.module");
const global_logger_service_1 = require("./common/logger/global-logger.service");
const request_logger_middleware_1 = require("./common/middleware/request-logger.middleware");
const ws_module_1 = require("./ws/ws.module");
const notification_service_1 = require("./utils/notification.service");
const utils_module_1 = require("./utils/utils.module");
const admin_module_1 = require("./admin/admin.module");
const health_module_1 = require("./health/health.module");
const surge_module_1 = require("./surge/surge.module");
const geo_surge_module_1 = require("./geosurge/geo-surge.module");
const payments_module_1 = require("./payments/payments.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const reports_module_1 = require("./reports/reports.module");
const schedule_1 = require("@nestjs/schedule");
const notifications_module_1 = require("./notifications/notifications.module");
const chat_live_gateway_1 = require("./ws/chat-live.gateway");
const chat_module_1 = require("./chat/chat.module");
const cache_module_1 = require("./cache/cache.module");
const metrics_module_1 = require("./metrics/metrics.module");
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
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'public'),
                serveRoot: '/public',
                serveStaticOptions: {
                    index: false,
                    fallthrough: false,
                },
            }),
            utils_module_1.UtilsModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            pharmacies_module_1.PharmaciesModule,
            riders_module_1.RidersModule,
            orders_module_1.OrdersModule,
            queue_module_1.QueueModule,
            admin_module_1.AdminModule,
            ws_module_1.WsModule,
            surge_module_1.SurgeModule,
            geo_surge_module_1.GeoSurgeModule,
            payments_module_1.PaymentsModule,
            webhooks_module_1.WebhooksModule,
            reports_module_1.ReportsModule,
            schedule_1.ScheduleModule.forRoot(),
            chat_module_1.ChatModule,
            cache_module_1.CacheModule,
            metrics_module_1.MetricsModule,
            notifications_module_1.NotificationsModule,
        ],
        providers: [notification_service_1.NotificationService, global_logger_service_1.GlobalLogger, chat_live_gateway_1.ChatLiveGateway],
    })
], AppModule);
