// src/geosurge/geo-surge.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { GeoSurgeService } from './geo-surge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/geo-surge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class GeoSurgeController {
  constructor(private readonly geoSurgeService: GeoSurgeService) {}

  @Get('status')
  async getZones(): Promise<{ count: number; zones: any[]; timestamp: string }> {
    const zones = await this.geoSurgeService.recalcAndBroadcast();
    return {
      count: zones.length,
      zones,
      timestamp: new Date().toISOString(),
    };
  }
}
