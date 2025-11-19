
// src/notifications/notifications.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.ADMIN, 'ADMIN', 'admin')
  async getAdminNotifications(@Req() req: any) {
    const adminId = Number(req.user?.id ?? req.user?.sub ?? req.user?.userId);

    return this.prisma.notification.findMany({
      where: { receiverId: adminId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
