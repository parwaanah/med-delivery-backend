import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerStorage,
  InjectThrottlerOptions,
  type ThrottlerModuleOptions, // ✅ use `type` import
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger: winston.Logger;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    protected readonly storageService: ThrottlerStorage, // ✅ must be protected, not private
    protected readonly reflector: Reflector, // ✅ must be protected, not private
  ) {
    super(options, storageService, reflector);

    // ✅ Ensure logs directory exists
    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }

    // 🧾 Winston rotating log setup
    const transport = new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'throttler-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'warn',
    });

    this.logger = winston.createLogger({
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        }),
      ),
      transports: [new winston.transports.Console(), transport],
    });
  }

  // ✅ Log details when throttling triggers
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const path = request.url;
    const user = request.user?.email || request.user?.id || 'anonymous';
    const ttlSeconds =
      typeof throttlerLimitDetail.ttl === 'number'
        ? throttlerLimitDetail.ttl / 1000
        : throttlerLimitDetail.ttl;

    const message = `⚠️ Throttle limit exceeded | User: ${user} | IP: ${ip} | Route: ${path} | Limit: ${throttlerLimitDetail.limit} | TTL: ${ttlSeconds}s`;

    this.logger.warn(message);

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
