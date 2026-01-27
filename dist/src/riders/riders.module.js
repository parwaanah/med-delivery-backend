"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidersModule = void 0;
const common_1 = require("@nestjs/common");
const riders_service_1 = require("./riders.service");
const riders_controller_1 = require("./riders.controller");
const rider_control_controller_1 = require("./rider-control.controller");
const rider_earnings_controller_1 = require("./rider-earnings.controller");
const rider_quality_controller_1 = require("./rider-quality.controller");
const rider_shift_service_1 = require("./rider-shift.service");
const rider_inactivity_cron_1 = require("./rider-inactivity.cron");
const rider_telemetry_service_1 = require("./rider-telemetry.service");
const rider_payments_service_1 = require("./rider-payments.service");
const rider_settlement_cron_1 = require("./rider-settlement.cron");
const rider_ledger_reconcile_cron_1 = require("./rider-ledger-reconcile.cron");
const rider_quality_service_1 = require("./rider-quality.service");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const geo_surge_module_1 = require("../geosurge/geo-surge.module");
const surge_module_1 = require("../surge/surge.module");
const ws_module_1 = require("../ws/ws.module");
let RidersModule = class RidersModule {
};
exports.RidersModule = RidersModule;
exports.RidersModule = RidersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => ws_module_1.WsModule),
            geo_surge_module_1.GeoSurgeModule,
            surge_module_1.SurgeModule,
        ],
        controllers: [
            riders_controller_1.RidersController,
            rider_control_controller_1.RiderControlController,
            rider_earnings_controller_1.RiderEarningsController,
            rider_quality_controller_1.RiderQualityController,
        ],
        providers: [
            riders_service_1.RidersService,
            rider_shift_service_1.RiderShiftService,
            rider_inactivity_cron_1.RiderInactivityCron,
            rider_telemetry_service_1.RiderTelemetryService,
            rider_payments_service_1.RiderPaymentsService,
            rider_settlement_cron_1.RiderSettlementCron,
            rider_ledger_reconcile_cron_1.RiderLedgerReconcileCron,
            rider_quality_service_1.RiderQualityService,
            prisma_service_1.PrismaService,
            notification_service_1.NotificationService,
        ],
        exports: [
            riders_service_1.RidersService,
            rider_telemetry_service_1.RiderTelemetryService,
            rider_payments_service_1.RiderPaymentsService,
            rider_quality_service_1.RiderQualityService,
        ],
    })
], RidersModule);
