// src/utils/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
    private fcm: FcmService,
  ) {}

  private pushEnabled() {
    const raw = String(process.env.PUSH_NOTIFICATIONS_ENABLED || '').trim();
    if (!raw) return true; // enabled by default if FCM key exists
    return raw.toLowerCase() === 'true';
  }

  private toFcmData(meta: any): Record<string, string> {
    if (!meta || typeof meta !== 'object') return {};

    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (v == null) continue;
      if (typeof v === 'string') out[k] = v;
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
      else out[k] = JSON.stringify(v);
    }
    return out;
  }

  private inferChannelId(typeOrEvent: string): 'order_updates' | 'promotions' {
    const t = String(typeOrEvent || '').toUpperCase();
    if (
      t.includes('ORDER') ||
      t.includes('PAYMENT') ||
      t.includes('PRESCRIPTION') ||
      t.includes('RIDER') ||
      t.includes('DELIVERY')
    ) {
      return 'order_updates';
    }
    return 'promotions';
  }

  private async pushToReceiver(receiverId: number, title: string, body: string, meta: any) {
    if (!this.pushEnabled()) return;

    // Respect per-user notification preferences (best-effort; defaults to enabled).
    const channel =
      (meta?.channelId ? String(meta.channelId) : '') ||
      (meta?.category ? String(meta.category) : '');

    if (channel) {
      try {
        const pref = await (this.prisma as any).notificationPreference.findUnique({
          where: { userId: receiverId },
          select: { orderUpdates: true, promotions: true },
        });
        const orderEnabled = pref?.orderUpdates !== false;
        const promoEnabled = pref?.promotions !== false;

        const ch = channel.toLowerCase();
        if ((ch === 'order_updates' || ch === 'order') && !orderEnabled) return;
        if ((ch === 'promotions' || ch === 'promo') && !promoEnabled) return;
      } catch {
        // ignore
      }
    }

    const tokens: Array<{ token: string }> = await (this.prisma as any).deviceToken.findMany({
      where: { userId: receiverId, enabled: true },
      select: { token: true },
      take: 25,
    });

    const deviceTokens = tokens.map((t: { token: string }) => t.token).filter(Boolean);
    if (!deviceTokens.length) return;

    await this.fcm.sendToTokens(deviceTokens, {
      title,
      body,
      data: this.toFcmData(meta),
      androidChannelId: channel ? String(channel) : undefined,
    });
  }

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

      // Best-effort push (disabled when FCM_SERVER_KEY missing)
      await this.pushToReceiver(receiverId, 'Med Delivery', message, {
        type,
        notificationId: notif.id,
        channelId: meta?.channelId || this.inferChannelId(type),
        ...(meta || {}),
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

      // Best-effort push (disabled when FCM_SERVER_KEY missing)
      await this.pushToReceiver(receiverId, 'Med Delivery', message, {
        eventName,
        notificationId: notif.id,
        channelId: (payload as any)?.channelId || this.inferChannelId(eventName),
        ...(payload || {}),
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
