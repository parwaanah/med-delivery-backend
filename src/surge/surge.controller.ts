// src/surge/surge.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SurgeService } from './surge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/surge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'ADMIN', 'admin')
export class SurgeController {
  constructor(private readonly surge: SurgeService) {}

  @Get('status')
  async status() {
    return this.surge.getStatus();
  }

  @Post('override')
  async override(@Body() body: { multiplier: number; setBy?: string }) {
    const m = Number(body.multiplier);
    if (!Number.isFinite(m) || m <= 0) {
      return { error: 'invalid multiplier' };
    }
    return this.surge.overrideMultiplier(m, { setBy: body.setBy });
  }

  @Post('reset')
  async reset() {
    return this.surge.clearOverride();
  }
}
