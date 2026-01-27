// src/riders/riders.controller.ts
import {
  Controller,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { UserRole } from '@prisma/client';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard)
@Roles(UserRole.RIDER)
export class RidersController {
  constructor(private riders: RidersService) {}

  @Patch(':id/location')
  async updateLocation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { lat: number; lon: number },
  ) {
    if (!body.lat || !body.lon)
      throw new BadRequestException('lat & lon required');

    if (Number(req.user?.id) !== Number(id)) {
      throw new ForbiddenException('Cannot update another rider');
    }

    return this.riders.updateLocation(Number(id), body.lat, body.lon);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' },
  ) {
    if (Number(req.user?.id) !== Number(id)) {
      throw new ForbiddenException('Cannot update another rider');
    }
    return this.riders.updateStatus(Number(id), body.status);
  }
}
