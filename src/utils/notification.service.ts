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

  async create(
    receiverId: number,
    type: string,
    message: string,
    meta: any = {},
    senderId?: number,
  ) {
    try {
      const notif = await this.prisma.notification.create({
        data: {
          receiverId,
          senderId: senderId ?? null,
          type,
          message,
          meta,
        },
      });

      this.ws.notifyUser(receiverId, 'notification.new', {
        id: notif.id,
        type: notif.type,
        status: notif.status,
        createdAt: notif.createdAt,
      });

      return notif;
    } catch (err) {
      this.logger.error('Notification failed:', err);
    }
  }

  /**
   * Persisted WS event with replay via /notifications.
   *
   * - Creates a Notification row (durable)
   * - Emits `notification.new` (existing UI)
   * - Emits a domain WS event (eventName) with `eventId` for at-least-once delivery
   */
  async createDomainEvent<TPayload extends Record<string, any>>(
    receiverId: number,
    eventName: string,
    message: string,
    payload: TPayload,
    senderId?: number,
  ) {
    try {
      const notif = await this.prisma.notification.create({
        data: {
          receiverId,
          senderId: senderId ?? null,
          type: eventName,
          message,
          meta: payload,
        },
      });

      this.ws.notifyUser(receiverId, 'notification.new', {
        id: notif.id,
        type: notif.type,
        status: notif.status,
        createdAt: notif.createdAt,
      });

      // Domain event channel (client can react immediately)
      this.ws.notifyUser(receiverId, eventName, {
        eventId: notif.id,
        ...payload,
      });

      return notif;
    } catch (err) {
      this.logger.error('Domain event notification failed:', err);
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
