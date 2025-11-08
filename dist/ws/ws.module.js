"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsModule = void 0;
const common_1 = require("@nestjs/common");
const ws_gateway_1 = require("./ws.gateway");
const audit_live_gateway_1 = require("./audit-live.gateway");
const rider_live_gateway_1 = require("./rider-live.gateway");
const surge_live_gateway_1 = require("./surge-live.gateway");
const prisma_service_1 = require("../utils/prisma.service");
let WsModule = class WsModule {
};
exports.WsModule = WsModule;
exports.WsModule = WsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            prisma_service_1.PrismaService,
            ws_gateway_1.WsGateway,
            audit_live_gateway_1.AuditLiveGateway,
            rider_live_gateway_1.RiderLiveGateway,
            surge_live_gateway_1.SurgeLiveGateway,
        ],
        exports: [
            ws_gateway_1.WsGateway,
            audit_live_gateway_1.AuditLiveGateway,
            rider_live_gateway_1.RiderLiveGateway,
            surge_live_gateway_1.SurgeLiveGateway,
        ],
    })
], WsModule);
