import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RiderQualityService } from '../riders/rider-quality.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/riders')
export class AdminRiderQualityController {
  constructor(private readonly quality: RiderQualityService) {}

  @Get(':id/quality')
  async qualitySummary(@Param('id') id: string) {
    const riderId = Number(id);
    if (isNaN(riderId)) throw new BadRequestException('Invalid rider id');
    return this.quality.summary(riderId);
  }

  @Post(':id/strikes')
  async addStrike(
    @Param('id') id: string,
    @Body()
    body: { type: string; points?: number; reason?: string; meta?: any },
  ) {
    const riderId = Number(id);
    if (isNaN(riderId)) throw new BadRequestException('Invalid rider id');
    if (!body?.type) throw new BadRequestException('type required');
    return this.quality.addStrike({
      riderId,
      type: body.type,
      points: body.points ?? 1,
      reason: body.reason,
      meta: body.meta,
    });
  }
}

