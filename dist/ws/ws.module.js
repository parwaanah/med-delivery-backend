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
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const ws_gateway_1 = require("./ws.gateway");
const audit_live_gateway_1 = require("./audit-live.gateway");
const surge_live_gateway_1 = require("./surge-live.gateway");
const rider_live_gateway_1 = require("./rider-live.gateway");
const chat_live_gateway_1 = require("./chat-live.gateway");
const geo_surge_live_gateway_1 = require("./geo-surge-live.gateway");
const chat_module_1 = require("../chat/chat.module");
let WsModule = class WsModule {
};
exports.WsModule = WsModule;
exports.WsModule = WsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            chat_module_1.ChatModule,
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_SECRET') || 'supersecret',
                    signOptions: { expiresIn: '1h' },
                }),
            }),
        ],
        providers: [
            ws_gateway_1.WsGateway,
            audit_live_gateway_1.AuditLiveGateway,
            surge_live_gateway_1.SurgeLiveGateway,
            rider_live_gateway_1.RiderLiveGateway,
            chat_live_gateway_1.ChatLiveGateway,
            geo_surge_live_gateway_1.GeoSurgeLiveGateway,
        ],
        exports: [
            ws_gateway_1.WsGateway,
            audit_live_gateway_1.AuditLiveGateway,
            surge_live_gateway_1.SurgeLiveGateway,
            rider_live_gateway_1.RiderLiveGateway,
            chat_live_gateway_1.ChatLiveGateway,
            geo_surge_live_gateway_1.GeoSurgeLiveGateway,
        ],
    })
], WsModule);
