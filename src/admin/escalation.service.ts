// src/admin/escalation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { GeoSurgeService, GeoPoint } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  private readonly defaultRiderSearchKm = 5;

  constructor(
    private readonly prisma: PrismaService,
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

  private async computeRiderScore(
    rp: GeoPoint,
    pickLat?: number,
    pickLon?: number,
  ) {
    const meta = rp.meta || {};
    const match = rp.memberId.match(/^rider:(\d+)$/);
    const riderId = match ? Number(match[1]) : NaN;

    let score = 0;

    // Availability
    if (!isNaN(riderId)) {
      const r = await this.prisma.user.findUnique({
        where: { id: riderId },
        select: { status: true },
      });
      score += r?.status === 'AVAILABLE' ? 40 : 10;
    }

    // Distance
    if (typeof rp.distKm === 'number') {
      score += Math.max(0, 30 - Math.min(30, rp.distKm * 6));
    } else if (pickLat && pickLon && meta?.lat && meta?.lon) {
      const km = this.haversineKm(
        Number(meta.lat),
        Number(meta.lon),
        pickLat,
        pickLon,
      );
      score += Math.max(0, 30 - Math.min(30, km * 6));
    }

    // Load
    if (!isNaN(riderId)) {
      const since = new Date(Date.now() - 30 * 60 * 1000);
      const assigned = await this.prisma.order.count({
        where: { riderId, createdAt: { gte: since } },
      });
      score += Math.max(0, 20 - assigned * 6);
    }

    // Surge
    try {
      const { multiplier } = await this.surge.getStatus();
      score += Math.min(10, Math.max(0, (multiplier - 1) * 5));
    } catch {}

    return Math.min(100, Math.round(score));
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
      pharmacy?.latitude == null ||
      pharmacy?.longitude == null
    ) {
      this.logger.warn(
        `Pharmacy ${order.pharmacyId} missing coordinates`,
      );
      return [];
    }

    const points = await this.geoSurge.findNearbyPoints(
      pharmacy.longitude,
      pharmacy.latitude,
      radiusKm,
      true,
      100,
    );

    const riders = points.filter((p) =>
      /^rider:\d+$/.test(p.memberId),
    );

    const scored = [];
    for (const rp of riders) {
      const score = await this.computeRiderScore(
        rp,
        pharmacy.latitude,
        pharmacy.longitude,
      );
      const match = rp.memberId.match(/^rider:(\d+)$/);

      scored.push({
        riderId: match ? Number(match[1]) : null,
        score,
        distKm: rp.distKm ?? null,
        meta: rp.meta,
      });
    }

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        ((a.distKm || 0) - (b.distKm || 0)),
    );

    return scored.slice(0, limit);
  }
}
