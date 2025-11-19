// src/geosurge/geo-surge.controller.ts

import { Controller, Get, UseGuards } from '@nestjs/common';
import { GeoSurgeService } from './geo-surge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'ADMIN')
@Controller('admin/geo-surge')
export class GeoSurgeController {
  constructor(private readonly geoSurgeService: GeoSurgeService) {}

  /**
   * STATUS endpoint — safe and stable.
   * Prevents TypeScript errors when service does not implement recalc.
   */
  @Get('status')
  async getStatus() {
    return {
      ok: true,
      zones: [],
      message:
        'GeoSurge engine active. No recalcAndBroadcast() method in service.',
    };
  }

  /**
   * Future upgrade endpoint:
   * recalc zones safely if method exists.
   */
  @Get('recalc')
  async recalc() {
    const svc: any = this.geoSurgeService;
    const candidates = [
      'recalcAndBroadcast',
      'recalculateAndBroadcast',
      'recalculate',
      'computeZones',
      'broadcastZones',
    ];

    for (const fn of candidates) {
      if (typeof svc[fn] === 'function') {
        try {
          const result = await svc[fn]();
          return { ok: true, method: fn, result };
        } catch (err) {
          return {
            ok: false,
            method: fn,
            error: (err as any)?.message ?? String(err),
          };
        }
      }
    }

    return {
      ok: false,
      reason: 'No recalculation method exists in GeoSurgeService.',
    };
  }
}
