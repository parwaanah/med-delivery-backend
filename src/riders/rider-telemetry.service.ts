import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { WsGateway } from '../ws/ws.gateway';
import { RiderShiftService } from './rider-shift.service';
import { RiderQualityService } from './rider-quality.service';
import { OrderStatus, UserRole } from '@prisma/client';

type LocationHeartbeat = {
  lat: number;
  lon: number;
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
  tsMs?: number; // client timestamp
};

@Injectable()
export class RiderTelemetryService {
  private readonly logger = new Logger(RiderTelemetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geo: GeoSurgeService,
    private readonly ws: WsGateway,
    private readonly shifts: RiderShiftService,
    private readonly quality: RiderQualityService,
  ) {}

  private locKey(riderId: number) {
    return `rider:loc:${riderId}`;
  }

  private lastPersistKey(riderId: number) {
    return `rider:loc:last_persist:${riderId}`;
  }

  private routeDevKey(orderId: number) {
    return `order:route_dev:${orderId}`;
  }

  private clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
  }

  private toRad(v: number) {
    return (v * Math.PI) / 180;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private persistIntervalMs() {
    const n = Number(process.env.RIDER_LOCATION_PERSIST_SEC || 10);
    if (!Number.isFinite(n)) return 10_000;
    return this.clamp(Math.floor(n), 2, 60) * 1000;
  }

  private locTtlSec() {
    const n = Number(process.env.RIDER_LOCATION_TTL_SEC || 120);
    if (!Number.isFinite(n)) return 120;
    return this.clamp(Math.floor(n), 30, 900);
  }

  private async computeConfidence(
    riderId: number,
    hb: LocationHeartbeat,
    nowMs: number,
  ) {
    let score = 100;

    const acc = hb.accuracyM != null ? Number(hb.accuracyM) : null;
    if (acc != null && Number.isFinite(acc)) {
      if (acc > 100) score -= 55;
      else if (acc > 50) score -= 35;
      else if (acc > 25) score -= 15;
    }

    const clientTs = hb.tsMs != null ? Number(hb.tsMs) : null;
    if (clientTs != null && Number.isFinite(clientTs)) {
      const ageSec = Math.abs(nowMs - clientTs) / 1000;
      if (ageSec > 60) score -= 45;
      else if (ageSec > 20) score -= 20;
    }

    const speed = hb.speedMps != null ? Number(hb.speedMps) : null;
    if (speed != null && Number.isFinite(speed)) {
      const kmh = speed * 3.6;
      if (kmh > 120) score -= 60;
      else if (kmh > 80) score -= 25;
    }

    // Penalize impossible jumps vs last seen location (from Redis cache).
    try {
      const prevRaw = await this.redis.client.get(this.locKey(riderId));
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        const prevLat = Number(prev?.lat);
        const prevLon = Number(prev?.lon);
        const prevTs = Number(prev?.serverTsMs);
        if (
          Number.isFinite(prevLat) &&
          Number.isFinite(prevLon) &&
          Number.isFinite(prevTs)
        ) {
          const dtSec = Math.max(1, Math.floor((nowMs - prevTs) / 1000));
          const km = this.haversineKm(prevLat, prevLon, hb.lat, hb.lon);
          const kmh = (km / dtSec) * 3600;
          if (kmh > 200) score -= 70;
          else if (kmh > 140) score -= 40;
        }
      }
    } catch {}

    return this.clamp(Math.round(score), 0, 100);
  }

  private async maybePersistLocation(riderId: number, lat: number, lon: number) {
    const now = Date.now();
    const intervalMs = this.persistIntervalMs();

    try {
      const lastRaw = await this.redis.client.get(this.lastPersistKey(riderId));
      const lastMs = lastRaw ? Number(lastRaw) : NaN;
      if (Number.isFinite(lastMs) && now - lastMs < intervalMs) return;
    } catch {}

    // Persist to DB + geo index
    await this.prisma.user.update({
      where: { id: riderId },
      data: { latitude: lat, longitude: lon },
    });

    try {
      await this.geo.addPoint(`rider:${riderId}`, lon, lat, {
        lat: String(lat),
        lon: String(lon),
      });
    } catch (err) {
      this.logger.warn(
        `Geo update failed for rider ${riderId}: ${(err as any)?.message}`,
      );
    }

    try {
      await this.redis.client.set(this.lastPersistKey(riderId), String(now), {
        EX: Math.max(60, Math.ceil(intervalMs / 1000) * 20),
      });
    } catch {}
  }

  private async maybeDetectRouteDeviation(
    riderId: number,
    lat: number,
    lon: number,
    confidence: number,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        riderId,
        status: { in: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.REACHED_PHARMACY, OrderStatus.PICKED_UP] },
      },
      select: { id: true, status: true, pharmacyId: true, customerId: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!order) return;

    let target: { lat: number; lon: number; kind: 'PHARMACY' | 'CUSTOMER' } | null = null;

    if (
      order.status === OrderStatus.OUT_FOR_DELIVERY ||
      order.status === OrderStatus.REACHED_PHARMACY
    ) {
      const ph = await this.prisma.user.findUnique({
        where: { id: order.pharmacyId },
        select: { latitude: true, longitude: true },
      });
      if (ph?.latitude != null && ph?.longitude != null) {
        target = { lat: ph.latitude, lon: ph.longitude, kind: 'PHARMACY' };
      }
    } else if (order.status === OrderStatus.PICKED_UP) {
      const cu = await this.prisma.user.findUnique({
        where: { id: order.customerId },
        select: { latitude: true, longitude: true },
      });
      if (cu?.latitude != null && cu?.longitude != null) {
        target = { lat: cu.latitude, lon: cu.longitude, kind: 'CUSTOMER' };
      }
    }

    if (!target) return;

    const distKm = this.haversineKm(lat, lon, target.lat, target.lon);

    // Track consecutive "moving away" updates.
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
          const increasing = distKm - lastDist > 0.2; // 200m away
          if (dtMs < 2 * 60 * 1000 && increasing) {
            incCount = this.clamp((Number.isFinite(lastInc) ? lastInc : 0) + 1, 0, 100);
          } else {
            incCount = 0;
          }
        }
      }
    } catch {}

    try {
      await this.redis.client.set(
        this.routeDevKey(order.id),
        JSON.stringify({ lastDistKm: distKm, lastTsMs: now, incCount }),
        { EX: 10 * 60 },
      );
    } catch {}

    // Flag deviation after repeated away-movement while still far from target.
    const deviating = incCount >= 3 && distKm >= 1.5 && confidence >= 20;
    if (!deviating) return;

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
    } catch {}

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
    } catch {}

    this.ws.notifyAdmins('rider.deviation', {
      orderId: order.id,
      riderId,
      status: order.status,
      target: target.kind,
      distKm,
      confidence,
    });
  }

  async locationHeartbeat(riderId: number, hb: LocationHeartbeat) {
    const lat = Number(hb?.lat);
    const lon = Number(hb?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false };
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return { ok: false };

    // Basic lifecycle enforcement: only real riders.
    const rider = await this.prisma.user.findUnique({
      where: { id: riderId },
      select: ({ id: true, role: true, status: true } as any),
    });
    if (!rider || String((rider as any).role) !== String(UserRole.RIDER)) {
      return { ok: false };
    }

    const nowMs = Date.now();
    const confidence = await this.computeConfidence(riderId, { ...hb, lat, lon }, nowMs);

    // GPS spoofing heuristic (rate-limited): impossible speed between heartbeats.
    try {
      const prevRaw = await this.redis.client.get(this.locKey(riderId));
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        const prevLat = Number(prev?.lat);
        const prevLon = Number(prev?.lon);
        const prevTs = Number(prev?.serverTsMs);
        if (
          Number.isFinite(prevLat) &&
          Number.isFinite(prevLon) &&
          Number.isFinite(prevTs)
        ) {
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
    } catch {}

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
    } catch {}

    // Throttled persistence to DB.
    await this.maybePersistLocation(riderId, lat, lon);

    // Heartbeat refresh for inactivity TTL.
    try {
      await this.shifts.heartbeat(riderId);
    } catch {}

    // Broadcast for live admin maps/UI.
    this.ws.broadcast('rider_location', payload);

    // Deviation detection for rider's active job.
    try {
      await this.maybeDetectRouteDeviation(riderId, lat, lon, confidence);
    } catch {}

    return { ok: true, confidence };
  }
}
