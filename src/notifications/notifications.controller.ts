
// src/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const MOBILE_PLATFORMS = new Set(['ANDROID', 'IOS', 'WEB']);

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const row = await (this.prisma as any).notificationPreference.findUnique({
      where: { userId },
      select: { orderUpdates: true, promotions: true, updatedAt: true },
    });

    return (
      row || {
        orderUpdates: true,
        promotions: true,
        updatedAt: null,
      }
    );
  }

  @Post('preferences')
  async upsertPreferences(
    @Req() req: any,
    @Body() body: { orderUpdates?: boolean; promotions?: boolean },
  ) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const orderUpdates = body?.orderUpdates !== false;
    const promotions = body?.promotions !== false;

    await (this.prisma as any).notificationPreference.upsert({
      where: { userId },
      update: { orderUpdates, promotions },
      create: { userId, orderUpdates, promotions },
    });

    return { ok: true };
  }

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

  // ----------------------------------------------------------
  // Device tokens (FCM/APNs) for mobile push notifications
  // ----------------------------------------------------------
  @Post('device-token')
  async upsertDeviceToken(
    @Req() req: any,
    @Body()
    body: {
      token?: string;
      platform?: string;
      deviceId?: string;
    },
  ) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const token = String(body?.token || '').trim();
    const platformRaw = String(body?.platform || '').trim().toUpperCase();
    const deviceId = body?.deviceId ? String(body.deviceId).trim() : null;

    if (!token) throw new BadRequestException('token is required');
    if (!MOBILE_PLATFORMS.has(platformRaw)) {
      throw new BadRequestException('Invalid platform');
    }

    const platform = platformRaw;

    await (this.prisma as any).deviceToken.upsert({
      where: { token },
      update: { userId, platform, deviceId, enabled: true, lastSeenAt: new Date() },
      create: { userId, token, platform, deviceId, enabled: true, lastSeenAt: new Date() },
    });

    return { ok: true };
  }

  @Post('device-token/disable')
  async disableDeviceToken(@Req() req: any, @Body() body: { token?: string }) {
    const userId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);
    const token = String(body?.token || '').trim();
    if (!token) throw new BadRequestException('token is required');

    const row = await (this.prisma as any).deviceToken.findUnique({ where: { token } });
    if (!row || row.userId !== userId) throw new BadRequestException('Device token not found');

    await (this.prisma as any).deviceToken.update({
      where: { token },
      data: { enabled: false, lastSeenAt: new Date() },
    });

    return { ok: true };
  }
}
