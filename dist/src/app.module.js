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
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const logging_throttler_guard_1 = require("./common/guards/logging-throttler.guard");
const http_logger_middleware_1 = require("./common/middleware/http-logger.middleware");
const error_logger_middleware_1 = require("./common/middleware/error-logger.middleware");
const configuration_1 = __importDefault(require("./config/configuration"));
const validation_1 = require("./config/validation");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const users_module_1 = require("./users/users.module");
const pharmacies_module_1 = require("./pharmacies/pharmacies.module");
const orders_module_1 = require("./orders/orders.module");
const medicines_module_1 = require("./medicines/medicines.module");
const auth_module_1 = require("./auth/auth.module");
const admin_module_1 = require("./admin/admin.module");
const riders_module_1 = require("./riders/riders.module");
const notifications_controller_1 = require("./notifications/notifications.controller");
const notifications_service_1 = require("./notifications/notifications.service");
const health_controller_1 = require("./health/health.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const logger_module_1 = require("./shared/logger/logger.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer
            .apply(http_logger_middleware_1.HttpLoggerMiddleware, error_logger_middleware_1.ErrorLoggerMiddleware)
            .forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
                validationSchema: validation_1.validationSchema,
            }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [
                    {
                        ttl: (0, throttler_1.seconds)(60),
                        limit: 10,
                    },
                ],
            }),
            prisma_module_1.PrismaModule,
            logger_module_1.LoggerModule,
            users_module_1.UsersModule,
            pharmacies_module_1.PharmaciesModule,
            orders_module_1.OrdersModule,
            medicines_module_1.MedicinesModule,
            auth_module_1.AuthModule,
            admin_module_1.AdminModule,
            riders_module_1.RidersModule,
        ],
        controllers: [app_controller_1.AppController, health_controller_1.HealthController, notifications_controller_1.NotificationsController],
        providers: [
            app_service_1.AppService,
            notifications_service_1.NotificationsService,
            {
                provide: core_1.APP_GUARD,
                useClass: logging_throttler_guard_1.LoggingThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map