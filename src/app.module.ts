import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PharmaciesModule } from './pharmacies/pharmacies.module';
import { RidersModule } from './riders/riders.module';
import { OrdersModule } from './orders/orders.module';
import { QueueModule } from './queues/queue.module';

import { GlobalLogger } from './common/logger/global-logger.service';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

import { WsModule } from './ws/ws.module';
import { NotificationService } from './utils/notification.service';
import { UtilsModule } from './utils/utils.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { SurgeModule } from './surge/surge.module';
import { GeoSurgeModule } from './geosurge/geo-surge.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReportsModule } from './reports/reports.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatLiveGateway } from './ws/chat-live.gateway';
import { ChatModule } from './chat/chat.module';
import { CacheModule } from './cache/cache.module';
import { MetricsModule } from './metrics/metrics.module';
import { MedicinesModule } from './medicines/medicines.module';

import { BullModule } from '@nestjs/bullmq';

// 🔥 UNIVERSAL REDIS FIX
function forcedRedisUrl(config: ConfigService): string {
  const url = 'redis://redis:6379';

  // Global override — prevents 127.0.0.1 anywhere
  process.env.REDIS_URL = url;
  process.env.REDIS_HOST = 'redis';
  process.env.REDIS_PORT = '6379';

  console.log('🔥 GLOBAL REDIS OVERRIDE →', url);
  return url;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/public',
      serveStaticOptions: {
        index: false,
        fallthrough: false,
      },
    }),

    /**
     * 🔥 GLOBAL BULLMQ REDIS CONFIG
     * Ensures Queue Workers, Bull, and every background service use redis://redis:6379
     */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: forcedRedisUrl(config), // NEVER localhost
        },
      }),
    }),

    UtilsModule,
    CacheModule,
    MetricsModule,
    HealthModule,

    AuthModule,
    UsersModule,
    PharmaciesModule,
    RidersModule,

    OrdersModule,
    PaymentsModule,
    WebhooksModule,

    QueueModule,
    AdminModule,
    WsModule,
    SurgeModule,
    GeoSurgeModule,
    ChatModule,
    NotificationsModule,

    MedicinesModule,

    ReportsModule,
    ScheduleModule.forRoot(),
  ],

  providers: [
    NotificationService,
    GlobalLogger,
    ChatLiveGateway,

    // 🔥 Universal force provider
    {
      provide: 'REDIS_FORCE_OVERRIDE',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = forcedRedisUrl(config);
        console.log('🔥 Redis override provider active →', url);
        return true;
      },
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
