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
const redis_service_1 = require("../utils/redis.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
const surge_service_1 = require("../surge/surge.service");
let EscalationService = EscalationService_1 = class EscalationService {
    constructor(prisma, redis, geoSurge, surge) {
        this.prisma = prisma;
        this.redis = redis;
        this.geoSurge = geoSurge;
        this.surge = surge;
        this.logger = new common_1.Logger(EscalationService_1.name);
        this.defaultRiderSearchKm = 5;
        this.recentLoadWindowMs = 30 * 60 * 1000;
        this.ratingWindowDays = 30;
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
    riderAvailabilityKey(riderId) {
        return `rider:availability:${riderId}`;
    }
    riderIdleSinceKey(riderId) {
        return `rider:idle_since:${riderId}`;
    }
    parseRiderId(memberId) {
        const match = memberId.match(/^rider:(\d+)$/);
        if (!match)
            return null;
        const id = Number(match[1]);
        return Number.isFinite(id) ? id : null;
    }
    computeScore(input) {
        const { rp, riderId, pickupLat, pickupLon, lifecycle, riderAvailability, cachedOnline, idleSinceMs, recentAssignedCount = 0, delivered30dCount = 0, surgeMultiplier = 1, } = input;
        if (cachedOnline && String(cachedOnline).toUpperCase() !== 'ONLINE') {
            return 0;
        }
        const life = String(lifecycle || '').toUpperCase();
        const avail = String(riderAvailability || '').toUpperCase();
        if (life !== 'ACTIVE' || avail !== 'AVAILABLE') {
            return 0;
        }
        let score = 40;
        const meta = (rp.meta || {});
        if (typeof rp.distKm === 'number') {
            score += Math.max(0, 30 - Math.min(30, rp.distKm * 6));
        }
        else if (meta?.lat != null && meta?.lon != null) {
            const km = this.haversineKm(Number(meta.lat), Number(meta.lon), pickupLat, pickupLon);
            score += Math.max(0, 30 - Math.min(30, km * 6));
        }
        score += Math.max(0, 20 - Math.min(20, recentAssignedCount * 6));
        if (idleSinceMs && Number.isFinite(idleSinceMs)) {
            const idleMinutes = Math.max(0, Math.floor((Date.now() - idleSinceMs) / 60000));
            score += Math.min(15, Math.floor(idleMinutes / 2));
        }
        const ratingPoints = Math.floor(Math.log2((delivered30dCount || 0) + 1) * 5);
        score += Math.min(15, Math.max(0, ratingPoints));
        score += Math.min(10, Math.max(0, (surgeMultiplier - 1) * 5));
        return Math.min(100, Math.max(0, Math.round(score)));
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
        if (!pharmacy ||
            pharmacy.latitude == null ||
            pharmacy.longitude == null) {
            this.logger.warn(`Pharmacy ${order.pharmacyId} missing coordinates`);
            return [];
        }
        const pickupLat = pharmacy.latitude;
        const pickupLon = pharmacy.longitude;
        const points = await this.geoSurge.findNearbyPoints(pickupLon, pickupLat, radiusKm, true, 100);
        const riders = points.filter((p) => /^rider:\d+$/.test(p.memberId));
        const riderIds = riders
            .map((rp) => this.parseRiderId(rp.memberId))
            .filter((v) => typeof v === 'number');
        let surgeMultiplier = 1;
        try {
            const s = await this.surge.getStatus();
            if (s?.multiplier != null)
                surgeMultiplier = Number(s.multiplier) || 1;
        }
        catch { }
        const sinceRecent = new Date(Date.now() - this.recentLoadWindowMs);
        const sinceDelivered = new Date(Date.now() - this.ratingWindowDays * 24 * 60 * 60 * 1000);
        const [userRows, recentGroup, deliveredGroup, cachedAvail, idleSince] = await Promise.all([
            this.prisma.user.findMany({
                where: { id: { in: riderIds } },
                select: { id: true, status: true, riderAvailability: true },
            }),
            this.prisma.order.groupBy({
                by: ['riderId'],
                where: { riderId: { in: riderIds }, createdAt: { gte: sinceRecent } },
                _count: { _all: true },
            }),
            this.prisma.order.groupBy({
                by: ['riderId'],
                where: {
                    riderId: { in: riderIds },
                    status: 'DELIVERED',
                    createdAt: { gte: sinceDelivered },
                },
                _count: { _all: true },
            }),
            (async () => {
                try {
                    const keys = riderIds.map((id) => this.riderAvailabilityKey(id));
                    return (await this.redis.client.mGet(keys));
                }
                catch {
                    return riderIds.map(() => null);
                }
            })(),
            (async () => {
                try {
                    const keys = riderIds.map((id) => this.riderIdleSinceKey(id));
                    return (await this.redis.client.mGet(keys));
                }
                catch {
                    return riderIds.map(() => null);
                }
            })(),
        ]);
        const userById = new Map();
        for (const u of userRows)
            userById.set(Number(u.id), u);
        const recentById = new Map();
        for (const row of recentGroup) {
            if (row?.riderId == null)
                continue;
            recentById.set(Number(row.riderId), Number(row?._count?._all || 0));
        }
        const deliveredById = new Map();
        for (const row of deliveredGroup) {
            if (row?.riderId == null)
                continue;
            deliveredById.set(Number(row.riderId), Number(row?._count?._all || 0));
        }
        const cachedById = new Map();
        const idleById = new Map();
        for (let i = 0; i < riderIds.length; i++) {
            const id = riderIds[i];
            cachedById.set(id, cachedAvail?.[i] ?? null);
            const n = idleSince?.[i] ? Number(idleSince[i]) : NaN;
            idleById.set(id, Number.isFinite(n) ? n : null);
        }
        const scored = riders.map((rp) => {
            const riderId = this.parseRiderId(rp.memberId);
            if (!riderId) {
                return {
                    riderId: null,
                    score: 0,
                    distKm: rp.distKm ?? null,
                    meta: rp.meta,
                };
            }
            const u = userById.get(riderId);
            const score = this.computeScore({
                rp,
                riderId,
                pickupLat,
                pickupLon,
                lifecycle: u?.status ?? null,
                riderAvailability: u?.riderAvailability ?? null,
                cachedOnline: cachedById.get(riderId) ?? null,
                idleSinceMs: idleById.get(riderId) ?? null,
                recentAssignedCount: recentById.get(riderId) ?? 0,
                delivered30dCount: deliveredById.get(riderId) ?? 0,
                surgeMultiplier,
            });
            return {
                riderId,
                score,
                distKm: rp.distKm ?? null,
                meta: rp.meta,
            };
        });
        scored.sort((a, b) => b.score - a.score ||
            ((a.distKm || 0) - (b.distKm || 0)));
        return scored.slice(0, limit);
    }
};
exports.EscalationService = EscalationService;
exports.EscalationService = EscalationService = EscalationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        geo_surge_service_1.GeoSurgeService,
        surge_service_1.SurgeService])
], EscalationService);
