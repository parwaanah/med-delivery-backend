import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------
  // GET /admin/notifications
  // ------------------------------------
  @Get()
  async list(@Req() req: any) {
    return this.prisma.notification.findMany({
      where: {
        receiverId: req.user.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ------------------------------------
  // PATCH /admin/notifications/:id/read
  // ------------------------------------
  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    const notifId = Number(id);
    if (isNaN(notifId)) {
      throw new BadRequestException('Invalid notification id');
    }

    const notif = await this.prisma.notification.findUnique({
      where: { id: notifId },
    });

    if (!notif || notif.receiverId !== req.user.id) {
      throw new BadRequestException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notifId },
      data: { status: 'READ' },
    });

    return { ok: true };
  }

  // ------------------------------------
  // PATCH /admin/notifications/read-all
  // ------------------------------------
  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    await this.prisma.notification.updateMany({
      where: {
        receiverId: req.user.id,
        status: { not: 'READ' },
      },
      data: {
        status: 'READ',
      },
    });

    return { ok: true };
  }
}
