"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoSurgeModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const geo_surge_service_1 = require("./geo-surge.service");
const geo_surge_controller_1 = require("./geo-surge.controller");
const geo_surge_live_gateway_1 = require("../ws/geo-surge-live.gateway");
let GeoSurgeModule = class GeoSurgeModule {
};
exports.GeoSurgeModule = GeoSurgeModule;
exports.GeoSurgeModule = GeoSurgeModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [geo_surge_service_1.GeoSurgeService, geo_surge_live_gateway_1.GeoSurgeLiveGateway],
        controllers: [geo_surge_controller_1.GeoSurgeController],
        exports: [geo_surge_service_1.GeoSurgeService, geo_surge_live_gateway_1.GeoSurgeLiveGateway],
    })
], GeoSurgeModule);
