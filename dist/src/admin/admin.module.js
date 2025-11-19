"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const admin_controller_1 = require("./admin.controller");
const admin_users_controller_1 = require("./admin.users.controller");
const admin_audit_controller_1 = require("./admin.audit.controller");
const admin_metrics_controller_1 = require("./admin.metrics.controller");
const admin_orders_controller_1 = require("./admin.orders.controller");
const admin_queue_controller_1 = require("./admin.queue.controller");
const admin_escalation_controller_1 = require("./admin-escalation.controller");
const escalation_service_1 = require("./escalation.service");
const orders_module_1 = require("../orders/orders.module");
const payments_module_1 = require("../payments/payments.module");
const surge_module_1 = require("../surge/surge.module");
const geo_surge_module_1 = require("../geosurge/geo-surge.module");
const ws_module_1 = require("../ws/ws.module");
const notification_service_1 = require("../utils/notification.service");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            ws_module_1.WsModule,
            orders_module_1.OrdersModule,
            payments_module_1.PaymentsModule,
            surge_module_1.SurgeModule,
            geo_surge_module_1.GeoSurgeModule,
        ],
        controllers: [
            admin_controller_1.AdminController,
            admin_users_controller_1.AdminUsersController,
            admin_audit_controller_1.AdminAuditController,
            admin_metrics_controller_1.AdminMetricsController,
            admin_orders_controller_1.AdminOrdersController,
            admin_queue_controller_1.AdminQueueController,
            admin_escalation_controller_1.AdminEscalationController,
        ],
        providers: [
            prisma_service_1.PrismaService,
            escalation_service_1.EscalationService,
            notification_service_1.NotificationService,
        ],
        exports: [escalation_service_1.EscalationService],
    })
], AdminModule);
