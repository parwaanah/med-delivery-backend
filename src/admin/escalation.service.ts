// src/admin/escalation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { GeoSurgeService, GeoPoint } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);
  // reuse same tuning values as OrdersService
  private readonly defaultRiderSearchKm = 5;
  private readonly riderSpeedKmPerHr = 30;

  constructor(
    private prisma: PrismaService,
    private geoSurge: GeoSurgeService,
    private surge: SurgeService,
  ) {}

  private toRad(v: number) { return (v * Math.PI) / 180; }
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

  // Combined rider score (availability + distance + recent load)
  private async computeRiderScore(rp: GeoPoint, pickLat?: number, pickLon?: number) {
    const meta = rp.meta || {};
    const match = rp.memberId.match(/^rider:(\d+)$/);
    const riderId = match ? Number(match[1]) : NaN;

    let score = 0;

    try {
      if (!isNaN(riderId)) {
        const r = await this.prisma.user.findUnique({
          where: { id: riderId },
          select: { status: true },
        });
        score += r?.status === 'AVAILABLE' ? 40 : 10;
      } else score += 10;
    } catch {
      score += 5;
    }

    // distance (up to 30 points)
    if (typeof rp.distKm === 'number') {
      const d = rp.distKm;
      score += Math.max(0, 30 - Math.min(30, d * 6));
    } else if (pickLat && pickLon && meta?.lat && meta?.lon) {
      const km = this.haversineKm(
        parseFloat(meta.lat),
        parseFloat(meta.lon),
        pickLat,
        pickLon,
      );
      score += Math.max(0, 30 - Math.min(30, km * 6));
    } else score += 5;

    // recent load (last 30 minutes) -> up to 30 points (less assigned => higher)
    try {
      if (!isNaN(riderId)) {
        const since = new Date(Date.now() - 30 * 60 * 1000);
        const assigned = await this.prisma.order.count({
          where: { riderId, createdAt: { gte: since } },
        });
        score += Math.max(0, 30 - Math.min(20, assigned * 6));
      } else score += 10;
    } catch {
      score += 10;
    }

    // small surge bonus
    try {
      const { multiplier } = await this.surge.getStatus();
      score += Math.max(0, Math.min(10, (multiplier - 1) * 5));
    } catch {
      // ignore
    }

    return Math.round(Math.min(100, score));
  }

  /**
   * Find candidate riders for an order (combined score sorting).
   * Returns array of { riderId, score, meta }.
   */
  async findCandidatesForOrder(orderId: number, radiusKm = this.defaultRiderSearchKm, limit = 20) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, pharmacyId: true, customerId: true },
    });
    if (!order) return [];

    // get pickup location: prefer order customer lat/lon or pharmacy lat/lon
    let pickLat: number | undefined;
    let pickLon: number | undefined;

    const pharm = await this.prisma.user.findUnique({
      where: { id: order.pharmacyId },
      select: { latitude: true, longitude: true },
    });
    if (pharm?.latitude && pharm?.longitude) {
      pickLat = pharm.latitude;
      pickLon = pharm.longitude;
    }

    // query GeoSurge
    const points = await this.geoSurge.findNearbyPoints(
      pickLon ?? 0,
      pickLat ?? 0,
      radiusKm,
      true,
      100,
    );

    const riderPoints = points.filter((pt) => /^rider:\d+$/.test(pt.memberId));
    const scored = [];
    for (const rp of riderPoints) {
      const score = await this.computeRiderScore(rp, pickLat, pickLon);
      const m = rp.memberId.match(/^rider:(\d+)$/);
      scored.push({ riderId: m ? Number(m[1]) : null, score, meta: rp.meta, distKm: rp.distKm ?? null });
    }

    scored.sort((a, b) => (b.score - a.score) || ( (a.distKm||0) - (b.distKm||0) ));
    return scored.slice(0, limit);
  }
}
