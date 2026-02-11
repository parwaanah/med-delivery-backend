import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export type AnalyticsEventName =
  | 'auth_success'
  | 'search'
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'order_created'
  | 'payment_requested'
  | 'payment_success'
  | 'payment_fail';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  track(input: {
    name: AnalyticsEventName | string;
    userId?: number | string | null;
    sessionId?: string | null;
    props?: Record<string, any>;
    ts?: string;
  }) {
    const payload = {
      ts: input.ts || new Date().toISOString(),
      name: String(input.name),
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      props: input.props ?? {},
    };

    // Always log (ship-safe; can be ingested by whatever log stack you use).
    this.logger.log(JSON.stringify({ event: 'analytics', ...payload }));

    // Also persist to DB for an in-house dashboard.
    // Best-effort: analytics must never break the main flow.
    try {
      const userIdNum =
        payload.userId != null && String(payload.userId).trim() !== '' ? Number(payload.userId) : null;
      void this.prisma.analyticsEvent.create({
        data: {
          name: payload.name,
          userId: Number.isFinite(userIdNum as any) ? (userIdNum as any) : null,
          sessionId: payload.sessionId,
          props: payload.props,
          createdAt: new Date(payload.ts),
        } as any,
      });
    } catch {
      // ignore
    }
  }
}
