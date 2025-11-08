// src/surge/surge.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SurgeService } from './surge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/surge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SurgeController {
  constructor(private readonly surge: SurgeService) {}

  @Get('status')
  status() {
    return this.surge.getStatus();
  }

  @Post('override')
  override(@Body() body: any) {
    return this.surge.overrideMultiplier(body.multiplier, body);
  }

  @Post('reset')
  reset() {
    return this.surge.clearOverride();
  }
}
