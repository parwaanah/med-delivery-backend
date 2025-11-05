// src/utils/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService, private wsGateway: WsGateway) {}

  /**
   * Creates and sends an in-app user notification + socket push
   */
  async create(
    receiverId: number,
    type: string,
    message: string,
    meta?: any,
    senderId?: number,
  ) {
    const n = await this.prisma.notification.create({
      data: {
        receiverId,
        senderId: senderId ?? null,
        type,
        message,
        meta: meta ?? null,
      },
    });

    // push to target user socket
    try {
      this.wsGateway.notifyUser(receiverId, 'notification', n);
    } catch (e) {
      this.logger.warn('notifyUser failed', e);
    }

    // also show a global admin toast for important events
    const toastTypes = ['ORDER_', 'LOGIN_', 'REGISTER_', 'ERROR', 'DELIVERED'];
    if (toastTypes.some((prefix) => type.startsWith(prefix))) {
      this.sendAdminToast({
        type: type.includes('ERROR') || type.includes('REJECTED') ? 'err' : 'ok',
        title: type.replace(/_/g, ' '),
        text: message,
      });
    }

    return n;
  }

  /**
   * Broadcast a toast to all admins on dashboard
   */
  sendAdminToast(payload: { type?: string; title: string; text: string; timeout?: number }) {
    try {
      this.wsGateway.server?.emit('admin_toast', payload);
      this.logger.log(`📡 Admin toast: ${payload.title}`);
    } catch (err) {
      this.logger.warn('Failed to emit admin toast', err);
    }
  }
}
