import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { SurgeService } from '../surge/surge.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

  constructor(
    private prisma: PrismaService,
    private notify: NotificationService,
    private geo: GeoSurgeService,
    private surge: SurgeService,
    private ws: WsGateway,
  ) {}

  async updateLocationWS(riderId: number, lat: number, lon: number) {
    await this.updateLocation(riderId, lat, lon);
  }

  async updateLocation(riderId: number, lat: number, lon: number) {
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

    this.ws.broadcast('rider_location', {
      riderId,
      lat,
      lon,
    });

    return { ok: true };
  }

  async updateStatus(riderId: number, status: 'AVAILABLE' | 'BUSY' | 'OFFLINE') {
    await this.prisma.user.update({
      where: { id: riderId },
      data: { status },
    });

    try {
      await this.surge.recordRiderAvailability(
        riderId,
        status === 'AVAILABLE',
      );
    } catch {}

    // ✅ Notify admins for live metrics refresh
    this.ws.notifyAdmins('admin_rider_event', {
      riderId,
      status,
    });

    this.ws.broadcast('rider_status', { riderId, status });
    return { ok: true };
  }
}
