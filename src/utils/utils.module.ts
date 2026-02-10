// src/utils/utils.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { JwtBlacklistService } from './jwt-blacklist.service';
import { RedisService } from './redis.service';
import { LockService } from './lock.service';
import { WsModule } from '../ws/ws.module';
import { DataRetentionService } from './data-retention.service';
import { FcmService } from './fcm.service';
import { SentryService } from './sentry.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Global()
@Module({
  imports: [WsModule],
  controllers: [AnalyticsController],
  providers: [
    PrismaService,
    NotificationService,
    AuditService,
    JwtBlacklistService,
    RedisService,
    LockService,
    DataRetentionService,
    FcmService,
    SentryService,
    AnalyticsService,
  ],
  exports: [
    PrismaService,
    NotificationService,
    AuditService,
    JwtBlacklistService,
    RedisService,
    LockService,
    FcmService,
    SentryService,
    AnalyticsService,
  ],
})
export class UtilsModule {}
