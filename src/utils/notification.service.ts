// src/utils/notification.service.ts
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
   * Create a notification record and attempt to deliver realtime (ws).
   * - receiverId: user who should receive it
   * - type: string e.g. 'ORDER_PLACED', 'ORDER_ASSIGNMENT_OFFER'
   * - message: human friendly message
   * - meta: optional JSON metadata
   * - senderId: optional id of actor
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

      // realtime push (personal room)
      try {
        this.ws.notifyUser(receiverId, 'notification', {
          id: n.id,
          type: n.type,
          message: n.message,
          meta: n.meta,
          createdAt: n.createdAt,
          status: n.status,
        });
      } catch (err) {
        this.logger.warn(`WS push failed for user ${receiverId}`, err as any);
      }

      // admin toast for certain events (optional)
      if (type.startsWith('ORDER_')) {
        this.sendAdminToast({
          type: 'info',
          title: `${type.replace(/_/g, ' ')}`,
          text: message,
          meta: { ...meta, receiverId, notifId: n.id },
        }).catch(() => {});
      }

      return n;
    } catch (err) {
      this.logger.error('create notification failed', err as any);
      throw err;
    }
  }

  /**
   * Send a lightweight toast to all admins (in 'admin' room).
   * payload: { type: 'ok'|'err'|'info', title: string, text: string, meta?: any }
   */
  async sendAdminToast(payload: { type: 'ok' | 'err' | 'info'; title: string; text: string; meta?: any }) {
    try {
      // Persist a system notification for auditing (optional)
      await this.prisma.notification.create({
        data: {
          senderId: null,
          receiverId: 1, // store a system-level row for admin exists (you may adapt)
          type: `ADMIN_TOAST`,
          message: `[ADMIN] ${payload.title} • ${payload.text}`,
          meta: payload.meta ?? {},
        },
      }).catch(() => { /* non-blocking */ });

      // Broadcast to admin room
      try {
        this.ws.broadcast('admin_toast', {
          type: payload.type,
          title: payload.title,
          text: payload.text,
          meta: payload.meta ?? {},
          at: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.warn('Failed to broadcast admin toast', err as any);
      }
    } catch (err) {
      this.logger.error('sendAdminToast failed', err as any);
    }
  }

  // Mark a notification as read
  async markRead(notificationId: number, userId: number) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.receiverId !== userId) return null;
    return this.prisma.notification.update({ where: { id: notificationId }, data: { status: 'READ' }});
  }

  // List notifications for a user (paged)
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
