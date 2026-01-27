// src/admin/escalation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RedisService } from '../utils/redis.service';
import { GeoSurgeService, GeoPoint } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  private readonly defaultRiderSearchKm = 5;
  private readonly recentLoadWindowMs = 30 * 60 * 1000; // 30 minutes
  private readonly ratingWindowDays = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly geoSurge: GeoSurgeService,
    private readonly surge: SurgeService,
  ) {}

  private toRad(v: number) {
    return (v * Math.PI) / 180;
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
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

  private riderAvailabilityKey(riderId: number) {
    return `rider:availability:${riderId}`;
  }

  private riderIdleSinceKey(riderId: number) {
    return `rider:idle_since:${riderId}`;
  }

  private parseRiderId(memberId: string): number | null {
    const match = memberId.match(/^rider:(\d+)$/);
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  }

  private computeScore(input: {
    rp: GeoPoint;
    riderId: number;
    pickupLat: number;
    pickupLon: number;
    lifecycle?: string | null;
    riderAvailability?: string | null;
    cachedOnline?: string | null;
    idleSinceMs?: number | null;
    recentAssignedCount?: number;
    delivered30dCount?: number;
    surgeMultiplier?: number;
  }) {
    const {
      rp,
      riderId,
      pickupLat,
      pickupLon,
      lifecycle,
      riderAvailability,
      cachedOnline,
      idleSinceMs,
      recentAssignedCount = 0,
      delivered30dCount = 0,
      surgeMultiplier = 1,
    } = input;

    // Hard gate: if we KNOW rider is offline in cache, skip.
    if (cachedOnline && String(cachedOnline).toUpperCase() !== 'ONLINE') {
      return 0;
    }

    const life = String(lifecycle || '').toUpperCase();
    const avail = String(riderAvailability || '').toUpperCase();
    if (life !== 'ACTIVE' || avail !== 'AVAILABLE') {
      return 0;
    }

    let score = 40; // base for ACTIVE + AVAILABLE (+ online cache if present)

    // Distance (0..30)
    const meta = (rp.meta || {}) as any;
    if (typeof rp.distKm === 'number') {
      score += Math.max(0, 30 - Math.min(30, rp.distKm * 6));
    } else if (meta?.lat != null && meta?.lon != null) {
      const km = this.haversineKm(
        Number(meta.lat),
        Number(meta.lon),
        pickupLat,
        pickupLon,
      );
      score += Math.max(0, 30 - Math.min(30, km * 6));
    }

    // Load (0..20) - fewer recent assignments => higher score
    score += Math.max(0, 20 - Math.min(20, recentAssignedCount * 6));

    // Idle time (0..15) - longer idle => higher score
    if (idleSinceMs && Number.isFinite(idleSinceMs)) {
      const idleMinutes = Math.max(
        0,
        Math.floor((Date.now() - idleSinceMs) / 60000),
      );
      score += Math.min(15, Math.floor(idleMinutes / 2));
    }

    // "Rating" proxy (0..15) - log scaled completed deliveries in last 30 days
    // 1 -> 0, 2 -> 5, 4 -> 10, 8+ -> 15
    const ratingPoints = Math.floor(Math.log2((delivered30dCount || 0) + 1) * 5);
    score += Math.min(15, Math.max(0, ratingPoints));

    // Surge (0..10) - higher surge slightly increases willingness to accept.
    score += Math.min(10, Math.max(0, (surgeMultiplier - 1) * 5));

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  async findCandidatesForOrder(
    orderId: number,
    radiusKm = this.defaultRiderSearchKm,
    limit = 20,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { pharmacyId: true },
    });
    if (!order) return [];

    const pharmacy = await this.prisma.user.findUnique({
      where: { id: order.pharmacyId },
      select: { latitude: true, longitude: true },
    });

    if (
      !pharmacy ||
      pharmacy.latitude == null ||
      pharmacy.longitude == null
    ) {
      this.logger.warn(
        `Pharmacy ${order.pharmacyId} missing coordinates`,
      );
      return [];
    }

    const pickupLat = pharmacy.latitude;
    const pickupLon = pharmacy.longitude;

    let points = await this.geoSurge.findNearbyPoints(
      pickupLon,
      pickupLat,
      radiusKm,
      true,
      100,
    );

    let riders = points.filter((p) =>
      /^rider:\d+$/.test(p.memberId),
    );

    // Fallback: if geo index is empty, use DB rider coordinates.
    if (riders.length === 0) {
      const dbRiders = await this.prisma.user.findMany({
        where: {
          role: 'RIDER' as any,
          status: 'ACTIVE' as any,
          riderAvailability: 'AVAILABLE' as any,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: { id: true, latitude: true, longitude: true },
        take: 200,
      });

      const fallback = (dbRiders as any[])
        .map((r) => {
          const lat = Number(r.latitude);
          const lon = Number(r.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const distKm = this.haversineKm(pickupLat, pickupLon, lat, lon);
          if (distKm > radiusKm) return null;
          return {
            memberId: `rider:${r.id}`,
            distKm,
            meta: { lat, lon },
          } as GeoPoint;
        })
        .filter((v): v is GeoPoint => !!v);

      points = fallback;
      riders = fallback;
    }

    // Last-resort fallback: online riders without GPS coords.
    if (riders.length === 0) {
      let onlineIds: number[] = [];
      try {
        const raw = await this.redis.client.sMembers('rider:online:set');
        onlineIds = (raw || [])
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v));
      } catch {}

      if (onlineIds.length > 0) {
        const onlineRiders = await this.prisma.user.findMany({
          where: {
            id: { in: onlineIds },
            role: 'RIDER' as any,
            status: 'ACTIVE' as any,
            riderAvailability: 'AVAILABLE' as any,
          },
          select: { id: true },
        });

        const fallback = (onlineRiders as any[]).map((r) => ({
          memberId: `rider:${r.id}`,
          distKm: undefined,
          meta: {},
        })) as GeoPoint[];

        points = fallback;
        riders = fallback;
      }
    }

    const riderIds = riders
      .map((rp) => this.parseRiderId(rp.memberId))
      .filter((v): v is number => typeof v === 'number');

    let surgeMultiplier = 1;
    try {
      const s = await this.surge.getStatus();
      if (s?.multiplier != null) surgeMultiplier = Number(s.multiplier) || 1;
    } catch {}

    const sinceRecent = new Date(Date.now() - this.recentLoadWindowMs);
    const sinceDelivered = new Date(
      Date.now() - this.ratingWindowDays * 24 * 60 * 60 * 1000,
    );

    const [userRows, recentGroup, deliveredGroup, cachedAvail, idleSince] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: riderIds } },
          select: ({ id: true, status: true, riderAvailability: true } as any),
        }),
        this.prisma.order.groupBy({
          by: ['riderId'],
          where: { riderId: { in: riderIds }, createdAt: { gte: sinceRecent } },
          _count: { _all: true },
        } as any),
        this.prisma.order.groupBy({
          by: ['riderId'],
          where: {
            riderId: { in: riderIds },
            status: 'DELIVERED',
            createdAt: { gte: sinceDelivered },
          },
          _count: { _all: true },
        } as any),
        (async () => {
          try {
            const keys = riderIds.map((id) => this.riderAvailabilityKey(id));
            return (await this.redis.client.mGet(keys)) as (string | null)[];
          } catch {
            return riderIds.map(() => null);
          }
        })(),
        (async () => {
          try {
            const keys = riderIds.map((id) => this.riderIdleSinceKey(id));
            return (await this.redis.client.mGet(keys)) as (string | null)[];
          } catch {
            return riderIds.map(() => null);
          }
        })(),
      ]);

    const userById = new Map<number, any>();
    for (const u of userRows as any[]) userById.set(Number(u.id), u);

    const recentById = new Map<number, number>();
    for (const row of recentGroup as any[]) {
      if (row?.riderId == null) continue;
      recentById.set(Number(row.riderId), Number(row?._count?._all || 0));
    }

    const deliveredById = new Map<number, number>();
    for (const row of deliveredGroup as any[]) {
      if (row?.riderId == null) continue;
      deliveredById.set(Number(row.riderId), Number(row?._count?._all || 0));
    }

    const cachedById = new Map<number, string | null>();
    const idleById = new Map<number, number | null>();
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

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        ((a.distKm || 0) - (b.distKm || 0)),
    );

    return scored.slice(0, limit);
  }
}
