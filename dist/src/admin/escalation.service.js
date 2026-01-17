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
var EscalationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
const surge_service_1 = require("../surge/surge.service");
let EscalationService = EscalationService_1 = class EscalationService {
    constructor(prisma, geoSurge, surge) {
        this.prisma = prisma;
        this.geoSurge = geoSurge;
        this.surge = surge;
        this.logger = new common_1.Logger(EscalationService_1.name);
        this.defaultRiderSearchKm = 5;
    }
    toRad(v) {
        return (v * Math.PI) / 180;
    }
    haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    async computeRiderScore(rp, pickLat, pickLon) {
        const meta = rp.meta || {};
        const match = rp.memberId.match(/^rider:(\d+)$/);
        const riderId = match ? Number(match[1]) : NaN;
        let score = 0;
        if (!isNaN(riderId)) {
            const r = await this.prisma.user.findUnique({
                where: { id: riderId },
                select: { status: true },
            });
            score += r?.status === 'AVAILABLE' ? 40 : 10;
        }
        if (typeof rp.distKm === 'number') {
            score += Math.max(0, 30 - Math.min(30, rp.distKm * 6));
        }
        else if (pickLat && pickLon && meta?.lat && meta?.lon) {
            const km = this.haversineKm(Number(meta.lat), Number(meta.lon), pickLat, pickLon);
            score += Math.max(0, 30 - Math.min(30, km * 6));
        }
        if (!isNaN(riderId)) {
            const since = new Date(Date.now() - 30 * 60 * 1000);
            const assigned = await this.prisma.order.count({
                where: { riderId, createdAt: { gte: since } },
            });
            score += Math.max(0, 20 - assigned * 6);
        }
        try {
            const { multiplier } = await this.surge.getStatus();
            score += Math.min(10, Math.max(0, (multiplier - 1) * 5));
        }
        catch { }
        return Math.min(100, Math.round(score));
    }
    async findCandidatesForOrder(orderId, radiusKm = this.defaultRiderSearchKm, limit = 20) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { pharmacyId: true },
        });
        if (!order)
            return [];
        const pharmacy = await this.prisma.user.findUnique({
            where: { id: order.pharmacyId },
            select: { latitude: true, longitude: true },
        });
        if (pharmacy?.latitude == null ||
            pharmacy?.longitude == null) {
            this.logger.warn(`Pharmacy ${order.pharmacyId} missing coordinates`);
            return [];
        }
        const points = await this.geoSurge.findNearbyPoints(pharmacy.longitude, pharmacy.latitude, radiusKm, true, 100);
        const riders = points.filter((p) => /^rider:\d+$/.test(p.memberId));
        const scored = [];
        for (const rp of riders) {
            const score = await this.computeRiderScore(rp, pharmacy.latitude, pharmacy.longitude);
            const match = rp.memberId.match(/^rider:(\d+)$/);
            scored.push({
                riderId: match ? Number(match[1]) : null,
                score,
                distKm: rp.distKm ?? null,
                meta: rp.meta,
            });
        }
        scored.sort((a, b) => b.score - a.score ||
            ((a.distKm || 0) - (b.distKm || 0)));
        return scored.slice(0, limit);
    }
};
exports.EscalationService = EscalationService;
exports.EscalationService = EscalationService = EscalationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        geo_surge_service_1.GeoSurgeService,
        surge_service_1.SurgeService])
], EscalationService);
