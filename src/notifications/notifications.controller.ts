// src/notifications/notifications.controller.ts
import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // 📬 Get all notifications for the logged-in user
  @Get('me')
  async getMyNotifications(@Req() req) {
    const user = req.user;
    return this.notificationsService.getNotificationsForUser(user.role, user.sub);
  }

  // 🧪 Test route — send manual notification (admin or test)
  @Post('test')
  async sendTestNotification(
    @Body() body: { targetType: 'pharmacy' | 'rider'; targetId: number; title: string; message: string },
  ) {
    return this.notificationsService.sendPush(body.targetType, body.targetId, body.title, body.message);
  }
}
