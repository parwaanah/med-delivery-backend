
// src/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);

    return this.prisma.notification.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const notifId = Number(id);
    if (isNaN(notifId)) throw new BadRequestException('Invalid notification id');

    const notif = await this.prisma.notification.findUnique({
      where: { id: notifId },
    });

    if (!notif || notif.receiverId !== userId) {
      throw new BadRequestException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notifId },
      data: { status: 'READ' },
    });

    return { ok: true };
  }

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);

    await this.prisma.notification.updateMany({
      where: {
        receiverId: userId,
        status: { not: 'READ' },
      },
      data: { status: 'READ' },
    });

    return { ok: true };
  }
}
