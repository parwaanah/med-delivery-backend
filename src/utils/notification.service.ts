import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
  ) {}

  /**
   * Create a notification record and deliver realtime (if possible).
   */
  async create(
    receiverId: number,
    type: string,
    message: string,
    meta?: Record<string, any>,
    senderId?: number,
  ) {
    try {
      const n = await this.prisma.notification.create({
        data: {
          senderId: senderId ?? null,
          receiverId,
          type,
          message,
          meta: meta ?? {},
          status: 'UNREAD',
        },
      });

      // 🔔 Try to push realtime via WS
      try {
        this.ws.notifyUser(receiverId, 'notification', {
          id: n.id,
          type: n.type,
          message: n.message,
          meta: n.meta ?? {},
          createdAt: n.createdAt,
          status: n.status,
        });
      } catch (err) {
        this.logger.warn(`WS push failed for user ${receiverId}: ${(err as any)?.message}`);
      }

      // 🧭 Auto admin toast for order-related notifications
      if (type.startsWith('ORDER_')) {
        this.sendAdminToast({
          type: 'info',
          title: type.replace(/_/g, ' '),
          text: message,
          meta: { ...meta, receiverId, notifId: n.id },
        }).catch(() => {});
      }

      return n;
    } catch (err) {
      this.logger.error(`❌ Failed to create notification: ${(err as any)?.message}`);
      throw err;
    }
  }

  /**
   * Send toast notifications to all admin users and broadcast via WS.
   */
  async sendAdminToast(payload: { 
    type: 'ok' | 'err' | 'info'; 
    title: string; 
    text: string; 
    meta?: any; 
  }) {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      const meta = payload.meta ?? {};
      const logMessage = `[ADMIN] ${payload.title} • ${payload.text}`;

      // Persist for all admins
      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            senderId: null,
            receiverId: admin.id,
            type: 'ADMIN_TOAST',
            message: logMessage,
            meta,
          },
        }).catch(() => {});
      }

      // WebSocket broadcast
      try {
        this.ws.notifyAdmins('admin_toast', {
          type: payload.type,
          title: payload.title,
          text: payload.text,
          meta,
          at: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.warn(`⚠️ WS broadcast failed: ${(err as any)?.message}`);
      }
    } catch (err) {
      this.logger.error(`❌ sendAdminToast failed: ${(err as any)?.message}`);
    }
  }

  /**
   * Mark a notification as read
   */
  async markRead(notificationId: number, userId: number) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.receiverId !== userId) return null;
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'READ' },
    });
  }

  /**
   * List notifications for a user (paged)
   */
  async listForUser(userId: number, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { receiverId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { receiverId: userId } }),
    ]);
    return { items, total, page, limit };
  }
}
