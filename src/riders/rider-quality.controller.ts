import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RiderQualityService } from './rider-quality.service';

@Controller('rider/quality')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard)
@Roles(UserRole.RIDER)
export class RiderQualityController {
  constructor(private readonly quality: RiderQualityService) {}

  @Get('summary')
  summary(@Req() req: Request & { user: any }) {
    return this.quality.summary(Number(req.user?.id));
  }
}

