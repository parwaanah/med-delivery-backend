import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import {
  CreatePharmacyDto,
  UpdatePharmacyDto,
} from './dto/pharmacy.dto';
import { GeoSurgeService } from '../geosurge/geo-surge.service';

@Injectable()
export class PharmaciesService {
  constructor(
    private prisma: PrismaService,
    private geoSurge: GeoSurgeService, // required for GEO indexing
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: 'PHARMACY' },
      select: {
        id: true,
        name: true,
        email: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: number) {
    const pharmacy = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');
    return pharmacy;
  }

  async create(dto: CreatePharmacyDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ForbiddenException('Email already in use');

    // ❗ DTO does NOT include latitude/longitude → set null
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: 'PHARMACY',
        latitude: null,
        longitude: null,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async update(id: number, dto: UpdatePharmacyDto) {
    const pharmacy = await this.prisma.user.findUnique({ where: { id } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? pharmacy.name,
        email: dto.email ?? pharmacy.email,
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async remove(id: number) {
    const pharmacy = await this.prisma.user.findUnique({ where: { id } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Pharmacy deleted successfully' };
  }

  // -------------------------------------------------
  //  UPDATE PHARMACY LOCATION  + Redis GEO Index
  // -------------------------------------------------
  async updateLocation(id: number, lat: number, lon: number) {
    const pharmacy = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    // Update DB
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        latitude: lat,
        longitude: lon,
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    // Update Redis GEO
    await this.geoSurge.addPoint(`pharmacy:${id}`, lon, lat, {
      lat: lat.toString(),
      lon: lon.toString(),
    });

    return { ok: true, ...updated };
  }
}
