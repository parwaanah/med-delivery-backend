// src/utils/notification.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: WsGateway, // will use gateway to push real-time
  ) {}

  async create(receiverId: number, type: string, message: string, meta?: any, senderId?: number) {
    const n = await this.prisma.notification.create({
      data: {
        receiverId,
        senderId: senderId ?? null,
        type,
        message,
        meta: meta ?? null,
      },
    });

    // push real-time via WebSocket (non-blocking)
    try {
      this.wsGateway.notifyUser(receiverId, 'notification', n);
    } catch (err) {
      // ignore; still persisted
    }

    return n;
  }
}
