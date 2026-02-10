import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryService {
  private readonly logger = new Logger(SentryService.name);
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const dsn = String(process.env.SENTRY_DSN || '').trim();
    if (!dsn) {
      this.logger.log('Sentry disabled (missing SENTRY_DSN)');
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || undefined,
    });

    this.logger.log('Sentry initialized');
  }

  captureException(err: any, context?: Record<string, any>) {
    try {
      if (!Sentry.getClient()) return;
      if (context) Sentry.setContext('extra', context);
      Sentry.captureException(err);
    } catch {
      // ignore
    }
  }
}

