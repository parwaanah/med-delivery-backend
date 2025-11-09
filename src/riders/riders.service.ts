// src/riders/riders.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import {
  CreateRiderDto,
  UpdateRiderDto,
  UpdateStatusDto,
} from './dto/rider.dto';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { RiderLiveGateway } from '../ws/rider-live.gateway';

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

  constructor(
    private prisma: PrismaService,
    private geoSurge: GeoSurgeService,
    private riderGateway: RiderLiveGateway,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'RIDER' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: number) {
    const rider = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });
    if (!rider) throw new NotFoundException('Rider not found');
    return rider;
  }

  async create(dto: CreateRiderDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ForbiddenException('Email already in use');

    const rider = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: 'RIDER',
        status: 'AVAILABLE',
        latitude: dto.latitude ?? 28.61,
        longitude: dto.longitude ?? 77.20,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        latitude: true,
        longitude: true,
      },
    });

    // ✅ Add to GeoSurge map
    try {
      await this.geoSurge.addPoint(
        `rider:${rider.id}`,
        rider.longitude ?? 77.2,
        rider.latitude ?? 28.61,
      );
    } catch (err) {
      this.logger.warn(`GeoSurge addPoint failed for rider:${rider.id}`);
    }

    return rider;
  }

  async update(id: number, dto: UpdateRiderDto) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? rider.name,
        email: dto.email ?? rider.email,
        latitude: dto.latitude ?? rider.latitude,
        longitude: dto.longitude ?? rider.longitude,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        latitude: true,
        longitude: true,
      },
    });

    // ✅ Update GeoSurge position
    try {
      if (updated.latitude && updated.longitude) {
        await this.geoSurge.addPoint(
          `rider:${id}`,
          updated.longitude,
          updated.latitude,
        );
      }
    } catch (err) {
      this.logger.warn(`GeoSurge updatePoint failed for rider:${id}`);
    }

    return updated;
  }

  async updateStatus(id: number, dto: UpdateStatusDto) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, name: true, email: true, status: true },
    });

    try {
      if (dto.status === 'AVAILABLE') {
        const lat = rider.latitude ?? 28.61;
        const lon = rider.longitude ?? 77.2;
        await this.geoSurge.addPoint(`rider:${rider.id}`, lon, lat);
      } else {
        await this.geoSurge.removePoint(`rider:${rider.id}`);
      }
    } catch (err) {
      this.logger.warn('GeoSurge rider status sync failed', err);
    }

    return updated;
  }

  async remove(id: number) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    await this.prisma.user.delete({ where: { id } });
    try {
      await this.geoSurge.removePoint(`rider:${id}`);
    } catch {}

    return { message: 'Rider deleted successfully' };
  }

  // ✅ NEW — Live GPS endpoint for dashboard + GeoSurge
  async updateLocation(id: number, lat: number, lon: number) {
    const rider = await this.prisma.user.findUnique({ where: { id } });
    if (!rider) throw new NotFoundException('Rider not found');

    await this.prisma.user.update({
      where: { id },
      data: { latitude: lat, longitude: lon },
    });

    try {
      await this.geoSurge.addPoint(`rider:${id}`, lon, lat);
    } catch (err) {
      this.logger.warn(`GeoSurge addPoint failed for rider:${id}`, err);
    }

    // 🔥 Broadcast to admin map via WebSocket
    this.riderGateway.notifyAdmins('rider_location', {
      id,
      lat,
      lon,
      status: rider.status,
      timestamp: Date.now(),
    });

    return { ok: true, id, lat, lon };
  }
}
