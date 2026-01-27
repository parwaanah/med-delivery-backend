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
var RiderTelemetryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiderTelemetryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../utils/prisma.service");
const redis_service_1 = require("../utils/redis.service");
const geo_surge_service_1 = require("../geosurge/geo-surge.service");
const ws_gateway_1 = require("../ws/ws.gateway");
const rider_shift_service_1 = require("./rider-shift.service");
const rider_quality_service_1 = require("./rider-quality.service");
const client_1 = require("@prisma/client");
let RiderTelemetryService = RiderTelemetryService_1 = class RiderTelemetryService {
    constructor(prisma, redis, geo, ws, shifts, quality) {
        this.prisma = prisma;
        this.redis = redis;
        this.geo = geo;
        this.ws = ws;
        this.shifts = shifts;
        this.quality = quality;
        this.logger = new common_1.Logger(RiderTelemetryService_1.name);
    }
    locKey(riderId) {
        return `rider:loc:${riderId}`;
    }
    lastPersistKey(riderId) {
        return `rider:loc:last_persist:${riderId}`;
    }
    routeDevKey(orderId) {
        return `order:route_dev:${orderId}`;
    }
    clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
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
    persistIntervalMs() {
        const n = Number(process.env.RIDER_LOCATION_PERSIST_SEC || 10);
        if (!Number.isFinite(n))
            return 10_000;
        return this.clamp(Math.floor(n), 2, 60) * 1000;
    }
    locTtlSec() {
        const n = Number(process.env.RIDER_LOCATION_TTL_SEC || 120);
        if (!Number.isFinite(n))
            return 120;
        return this.clamp(Math.floor(n), 30, 900);
    }
    async computeConfidence(riderId, hb, nowMs) {
        let score = 100;
        const acc = hb.accuracyM != null ? Number(hb.accuracyM) : null;
        if (acc != null && Number.isFinite(acc)) {
            if (acc > 100)
                score -= 55;
            else if (acc > 50)
                score -= 35;
            else if (acc > 25)
                score -= 15;
        }
        const clientTs = hb.tsMs != null ? Number(hb.tsMs) : null;
        if (clientTs != null && Number.isFinite(clientTs)) {
            const ageSec = Math.abs(nowMs - clientTs) / 1000;
            if (ageSec > 60)
                score -= 45;
            else if (ageSec > 20)
                score -= 20;
        }
        const speed = hb.speedMps != null ? Number(hb.speedMps) : null;
        if (speed != null && Number.isFinite(speed)) {
            const kmh = speed * 3.6;
            if (kmh > 120)
                score -= 60;
            else if (kmh > 80)
                score -= 25;
        }
        try {
            const prevRaw = await this.redis.client.get(this.locKey(riderId));
            if (prevRaw) {
                const prev = JSON.parse(prevRaw);
                const prevLat = Number(prev?.lat);
                const prevLon = Number(prev?.lon);
                const prevTs = Number(prev?.serverTsMs);
                if (Number.isFinite(prevLat) &&
                    Number.isFinite(prevLon) &&
                    Number.isFinite(prevTs)) {
                    const dtSec = Math.max(1, Math.floor((nowMs - prevTs) / 1000));
                    const km = this.haversineKm(prevLat, prevLon, hb.lat, hb.lon);
                    const kmh = (km / dtSec) * 3600;
                    if (kmh > 200)
                        score -= 70;
                    else if (kmh > 140)
                        score -= 40;
                }
            }
        }
        catch { }
        return this.clamp(Math.round(score), 0, 100);
    }
    async maybePersistLocation(riderId, lat, lon) {
        const now = Date.now();
        const intervalMs = this.persistIntervalMs();
        try {
            const lastRaw = await this.redis.client.get(this.lastPersistKey(riderId));
            const lastMs = lastRaw ? Number(lastRaw) : NaN;
            if (Number.isFinite(lastMs) && now - lastMs < intervalMs)
                return;
        }
        catch { }
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
        try {
            await this.redis.client.set(this.lastPersistKey(riderId), String(now), {
                EX: Math.max(60, Math.ceil(intervalMs / 1000) * 20),
            });
        }
        catch { }
    }
    async maybeDetectRouteDeviation(riderId, lat, lon, confidence) {
        const order = await this.prisma.order.findFirst({
            where: {
                riderId,
                status: { in: [client_1.OrderStatus.OUT_FOR_DELIVERY, client_1.OrderStatus.REACHED_PHARMACY, client_1.OrderStatus.PICKED_UP] },
            },
            select: { id: true, status: true, pharmacyId: true, customerId: true },
            orderBy: { updatedAt: 'desc' },
        });
        if (!order)
            return;
        let target = null;
        if (order.status === client_1.OrderStatus.OUT_FOR_DELIVERY ||
            order.status === client_1.OrderStatus.REACHED_PHARMACY) {
            const ph = await this.prisma.user.findUnique({
                where: { id: order.pharmacyId },
                select: { latitude: true, longitude: true },
            });
            if (ph?.latitude != null && ph?.longitude != null) {
                target = { lat: ph.latitude, lon: ph.longitude, kind: 'PHARMACY' };
            }
        }
        else if (order.status === client_1.OrderStatus.PICKED_UP) {
            const cu = await this.prisma.user.findUnique({
                where: { id: order.customerId },
                select: { latitude: true, longitude: true },
            });
            if (cu?.latitude != null && cu?.longitude != null) {
                target = { lat: cu.latitude, lon: cu.longitude, kind: 'CUSTOMER' };
            }
        }
        if (!target)
            return;
        const distKm = this.haversineKm(lat, lon, target.lat, target.lon);
        const now = Date.now();
        let incCount = 0;
        let prevDist = distKm;
        try {
            const raw = await this.redis.client.get(this.routeDevKey(order.id));
            if (raw) {
                const prev = JSON.parse(raw);
                const lastDist = Number(prev?.lastDistKm);
                const lastTs = Number(prev?.lastTsMs);
                const lastInc = Number(prev?.incCount);
                if (Number.isFinite(lastDist) && Number.isFinite(lastTs)) {
                    prevDist = lastDist;
                    const dtMs = now - lastTs;
                    const increasing = distKm - lastDist > 0.2;
                    if (dtMs < 2 * 60 * 1000 && increasing) {
                        incCount = this.clamp((Number.isFinite(lastInc) ? lastInc : 0) + 1, 0, 100);
                    }
                    else {
                        incCount = 0;
                    }
                }
            }
        }
        catch { }
        try {
            await this.redis.client.set(this.routeDevKey(order.id), JSON.stringify({ lastDistKm: distKm, lastTsMs: now, incCount }), { EX: 10 * 60 });
        }
        catch { }
        const deviating = incCount >= 3 && distKm >= 1.5 && confidence >= 20;
        if (!deviating)
            return;
        try {
            const key = `order:route_dev:flagged:${order.id}`;
            const already = await this.redis.client.get(key);
            if (!already) {
                await this.redis.client.set(key, '1', { EX: 10 * 60 });
                await this.quality.addFraudSignal({
                    riderId,
                    type: 'ABNORMAL_ROUTE',
                    severity: 60,
                    strikePoints: 2,
                    reason: 'Route deviation detected',
                    meta: {
                        orderId: order.id,
                        status: order.status,
                        target: target.kind,
                        distKm,
                        prevDistKm: prevDist,
                        incCount,
                        confidence,
                    },
                });
            }
        }
        catch { }
        try {
            await this.prisma.orderTimeline.create({
                data: {
                    orderId: order.id,
                    event: 'ROUTE_DEVIATION',
                    data: JSON.stringify({
                        riderId,
                        target: target.kind,
                        distKm,
                        prevDistKm: prevDist,
                        incCount,
                        confidence,
                    }),
                },
            });
        }
        catch { }
        this.ws.notifyAdmins('rider.deviation', {
            orderId: order.id,
            riderId,
            status: order.status,
            target: target.kind,
            distKm,
            confidence,
        });
    }
    async locationHeartbeat(riderId, hb) {
        const lat = Number(hb?.lat);
        const lon = Number(hb?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon))
            return { ok: false };
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
            return { ok: false };
        const rider = await this.prisma.user.findUnique({
            where: { id: riderId },
            select: { id: true, role: true, status: true },
        });
        if (!rider || String(rider.role) !== String(client_1.UserRole.RIDER)) {
            return { ok: false };
        }
        const nowMs = Date.now();
        const confidence = await this.computeConfidence(riderId, { ...hb, lat, lon }, nowMs);
        try {
            const prevRaw = await this.redis.client.get(this.locKey(riderId));
            if (prevRaw) {
                const prev = JSON.parse(prevRaw);
                const prevLat = Number(prev?.lat);
                const prevLon = Number(prev?.lon);
                const prevTs = Number(prev?.serverTsMs);
                if (Number.isFinite(prevLat) &&
                    Number.isFinite(prevLon) &&
                    Number.isFinite(prevTs)) {
                    const dtSec = Math.max(1, Math.floor((nowMs - prevTs) / 1000));
                    const km = this.haversineKm(prevLat, prevLon, lat, lon);
                    const kmh = (km / dtSec) * 3600;
                    const threshold = Number(process.env.RIDER_GPS_SPOOF_KMH || 160);
                    if (Number.isFinite(kmh) && kmh >= threshold && dtSec <= 60) {
                        const k = `rider:fraud:gps:${riderId}`;
                        const seen = await this.redis.client.get(k);
                        if (!seen) {
                            await this.redis.client.set(k, '1', { EX: 5 * 60 });
                            await this.quality.addFraudSignal({
                                riderId,
                                type: 'GPS_SPOOFING',
                                severity: 85,
                                strikePoints: 5,
                                reason: `Impossible speed ${kmh.toFixed(1)}km/h`,
                                meta: { kmh, dtSec, km, prevLat, prevLon, lat, lon, confidence },
                            });
                        }
                    }
                }
            }
        }
        catch { }
        const payload = {
            riderId,
            lat,
            lon,
            accuracyM: hb.accuracyM ?? null,
            speedMps: hb.speedMps ?? null,
            headingDeg: hb.headingDeg ?? null,
            clientTsMs: hb.tsMs ?? null,
            serverTsMs: nowMs,
            confidence,
        };
        try {
            await this.redis.client.set(this.locKey(riderId), JSON.stringify(payload), {
                EX: this.locTtlSec(),
            });
        }
        catch { }
        await this.maybePersistLocation(riderId, lat, lon);
        try {
            await this.shifts.heartbeat(riderId);
        }
        catch { }
        this.ws.broadcast('rider_location', payload);
        try {
            await this.maybeDetectRouteDeviation(riderId, lat, lon, confidence);
        }
        catch { }
        return { ok: true, confidence };
    }
};
exports.RiderTelemetryService = RiderTelemetryService;
exports.RiderTelemetryService = RiderTelemetryService = RiderTelemetryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        geo_surge_service_1.GeoSurgeService,
        ws_gateway_1.WsGateway,
        rider_shift_service_1.RiderShiftService,
        rider_quality_service_1.RiderQualityService])
], RiderTelemetryService);
