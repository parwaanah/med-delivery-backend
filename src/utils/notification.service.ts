// src/utils/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    receiverId: number,
    type: string,
    message: string,
    meta: any = {},
    senderId?: number,
  ) {
    try {
      return await this.prisma.notification.create({
        data: {
          receiverId,
          senderId: senderId ?? null,
          type,
          message,
          meta,
        },
      });
    } catch (err) {
      this.logger.error('Notification failed:', err);
    }
  }

  // Dashboard toast (no WebSocket required)
  sendAdminToast(data: {
    type: 'ok' | 'info' | 'err';
    title: string;
    text: string;
  }) {
    this.logger.debug(`Admin Toast: ${data.title} — ${data.text}`);
  }
}
