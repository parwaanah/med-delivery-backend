import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';

type FcmMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
  androidChannelId?: string;
};

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  private get serverKey() {
    const key = String(process.env.FCM_SERVER_KEY || '').trim();
    return key || null;
  }

  /**
   * Sends to raw FCM device tokens using legacy FCM HTTP API.
   * Requires `FCM_SERVER_KEY` env var.
   *
   * Note: For production, prefer FCM HTTP v1 with service accounts.
   */
  async sendToTokens(tokens: string[], message: FcmMessage) {
    const key = this.serverKey;
    if (!key) return { ok: false, skipped: true, reason: 'FCM_SERVER_KEY missing' };
    const unique = Array.from(new Set(tokens.filter(Boolean)));
    if (!unique.length) return { ok: true, success: 0, failure: 0 };

    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registration_ids: unique,
          notification: {
            title: message.title,
            body: message.body,
            ...(message.androidChannelId
              ? { android_channel_id: message.androidChannelId }
              : null),
          },
          data: message.data || {},
          priority: 'high',
        }),
      });

      const json: any = await res.json().catch(() => null);
      if (!res.ok) {
        this.logger.warn(`FCM send failed: ${res.status} ${res.statusText}`);
        return { ok: false, status: res.status, response: json };
      }

      return { ok: true, response: json };
    } catch (e) {
      this.logger.warn('FCM send error', (e as any)?.message ?? e);
      return { ok: false, error: (e as any)?.message ?? String(e) };
    }
  }
}
