import {
  Body,
  Controller,
  Patch,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { AuditService } from '../utils/audit.service';
import { WsGateway } from '../ws/ws.gateway';
import { RiderShiftService } from './rider-shift.service';

@Controller('rider')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderControlController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ws: WsGateway,
    private readonly shift: RiderShiftService,
  ) {}

  // Allows rider to toggle lifecycle between ACTIVE and OFFLINE.
  // This is intentionally allowed even when rider is OFFLINE via ApprovalGuard allow-list.
  @Patch('lifecycle')
  async setLifecycle(
    @Req() req: Request & { user: any },
    @Body() body: { state: 'ACTIVE' | 'OFFLINE' },
  ) {
    const riderId = Number(req.user?.id);
    const state = String(body?.state || '').toUpperCase();
    if (!riderId) throw new BadRequestException('Invalid rider');
    if (state !== 'ACTIVE' && state !== 'OFFLINE') {
      throw new BadRequestException('Invalid state');
    }

    const current = await this.prisma.user.findUnique({
      where: { id: riderId },
      select: { id: true, role: true, status: true },
    });
    if (!current || current.role !== UserRole.RIDER) {
      throw new BadRequestException('Rider not found');
    }
    if (current.status === 'SUSPENDED') {
      throw new ForbiddenException('Account suspended');
    }
    if (current.status === 'PENDING' || current.status === 'REJECTED') {
      throw new ForbiddenException('Account not approved yet');
    }

    const updated = await this.prisma.user.update(({
      where: { id: riderId },
      data: {
        status: state,
        riderAvailability: state === 'ACTIVE' ? 'AVAILABLE' : 'OFFLINE',
      },
      select: { id: true, status: true, riderAvailability: true },
    } as any));

    await this.audit.logAdminAction({
      userId: riderId,
      action: 'RIDER_LIFECYCLE_CHANGED',
      resource: `rider:${riderId}`,
      meta: { from: current.status, to: state },
    });

    this.ws.notifyAdmins('admin_rider_event', {
      riderId,
      status: updated.status,
      riderAvailability: (updated as any).riderAvailability,
      source: 'rider',
    });
    this.ws.notifyUser(riderId, 'user.status', { status: updated.status });

    return { ok: true, status: updated.status };
  }

  @Patch('availability')
  async setAvailability(
    @Req() req: Request & { user: any },
    @Body() body: { state: 'ONLINE' | 'OFFLINE' },
  ) {
    const riderId = Number(req.user?.id);
    const state = String(body?.state || '').toUpperCase();
    if (!riderId) throw new BadRequestException('Invalid rider');
    if (state !== 'ONLINE' && state !== 'OFFLINE') {
      throw new BadRequestException('Invalid state');
    }

    const res = await this.shift.setAvailability(riderId, state as any);

    await this.audit.logAdminAction({
      userId: riderId,
      action: 'RIDER_AVAILABILITY_CHANGED',
      resource: `rider:${riderId}`,
      meta: { state },
    });

    return res;
  }

  @Patch('heartbeat')
  async heartbeat(@Req() req: Request & { user: any }) {
    const riderId = Number(req.user?.id);
    if (!riderId) throw new BadRequestException('Invalid rider');
    await this.shift.heartbeat(riderId);
    return { ok: true };
  }

  @Patch('shift/current')
  async currentShift(@Req() req: Request & { user: any }) {
    const riderId = Number(req.user?.id);
    if (!riderId) throw new BadRequestException('Invalid rider');
    return this.shift.currentShift(riderId);
  }
}
