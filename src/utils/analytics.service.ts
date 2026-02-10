import { Injectable, Logger } from '@nestjs/common';

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

    // Ship-safe: log-only (can be ingested by whatever log stack you use).
    this.logger.log(JSON.stringify({ event: 'analytics', ...payload }));
  }
}

