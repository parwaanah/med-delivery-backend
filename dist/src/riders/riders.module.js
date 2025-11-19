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
        controllers: [riders_controller_1.RidersController],
        providers: [
            riders_service_1.RidersService,
            prisma_service_1.PrismaService,
            notification_service_1.NotificationService,
        ],
        exports: [riders_service_1.RidersService],
    })
], RidersModule);
