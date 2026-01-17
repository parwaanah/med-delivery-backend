"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RidersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RidersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const notification_service_1 = require("../utils/notification.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
const surge_service_1 = require("../surge/surge.service");
const ws_gateway_1 = require("../ws/ws.gateway");
let RidersService = RidersService_1 = class RidersService {
    constructor(prisma, notify, geo, surge, ws) {
        this.prisma = prisma;
        this.notify = notify;
        this.geo = geo;
        this.surge = surge;
        this.ws = ws;
        this.logger = new common_1.Logger(RidersService_1.name);
    }
    async updateLocationWS(riderId, lat, lon) {
        await this.updateLocation(riderId, lat, lon);
    }
    async updateLocation(riderId, lat, lon) {
        await this.prisma.user.update({
            where: { id: riderId },
            data: { latitude: lat, longitude: lon },
        });
        try {
            await this.geo.addPoint(`rider:${riderId}`, lon, lat, {
                lat: String(lat),
                lon: String(lon),
            });
        }
        catch (err) {
            this.logger.warn(`Geo update failed for rider ${riderId}: ${err?.message}`);
        }
        this.ws.broadcast('rider_location', {
            riderId,
            lat,
            lon,
        });
        return { ok: true };
    }
    async updateStatus(riderId, status) {
        await this.prisma.user.update({
            where: { id: riderId },
            data: { status },
        });
        try {
            await this.surge.recordRiderAvailability(riderId, status === 'AVAILABLE');
        }
        catch { }
        this.ws.notifyAdmins('admin_rider_event', {
            riderId,
            status,
        });
        this.ws.broadcast('rider_status', { riderId, status });
        return { ok: true };
    }
};
exports.RidersService = RidersService;
exports.RidersService = RidersService = RidersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        geo_surge_service_1.GeoSurgeService,
        surge_service_1.SurgeService,
        ws_gateway_1.WsGateway])
], RidersService);
