// src/utils/debug.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('debug')
export class DebugController {
  constructor(private notificationService: NotificationService) {}

  @Post('notify')
  async sendTestNotification(
    @Body() body: { userId: number; type: string; message: string; meta?: any },
  ) {
    return this.notificationService.create(
      body.userId,
      body.type,
      body.message,
      body.meta,
    );
  }
}
