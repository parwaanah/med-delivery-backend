import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

/* CORE */
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PharmaciesModule } from './pharmacies/pharmacies.module';
import { RidersModule } from './riders/riders.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';

/* ADMIN + SYSTEM */
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ReportsModule } from './reports/reports.module';

/* REALTIME + QUEUES */
import { WsModule } from './ws/ws.module';
import { QueueModule } from './queues/queue.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';

/* DOMAIN */
import { MedicinesModule } from './medicines/medicines.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SurgeModule } from './surge/surge.module';
import { GeoSurgeModule } from './geosurge/geo-surge.module';

/* UTILS */
import { UtilsModule } from './utils/utils.module';
import { CacheModule } from './cache/cache.module';
import { UploadsModule } from './uploads/uploads.module';
import { ProfileModule } from './auth/profile.module';
import { ServiceAreaModule } from './service-area/service-area.module';
import { SupportModule } from './support/support.module';
import { RefundsModule } from './refunds/refunds.module';

/* LOGGER */
import { GlobalLogger } from './common/logger/global-logger.service';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { NotificationService } from './utils/notification.service';
import { ChatLiveGateway } from './ws/chat-live.gateway';

/* 🔥 REDIS FORCE */
function forcedRedisUrl(config: ConfigService): string {
  const url = 'redis://redis:6379';

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
      serveStaticOptions: { index: false, fallthrough: false },
    }),

    /* 🔥 GLOBAL REDIS FOR BULLMQ */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: forcedRedisUrl(config),
        },
      }),
    }),

    /* CORE */
    AuthModule,
    UsersModule,
    PharmaciesModule,
    RidersModule,
    OrdersModule,
    CartModule,

    /* SYSTEM */
    AdminModule,
    HealthModule,
    MetricsModule,
    ReportsModule,

    /* REALTIME */
    WsModule,
    QueueModule,
    NotificationsModule,
    ChatModule,

    /* DOMAIN */
    MedicinesModule,
    PaymentsModule,
    WebhooksModule,
    SurgeModule,
    GeoSurgeModule,

    /* UTILS */
    UtilsModule,
    CacheModule,
    UploadsModule,
    ProfileModule,
    ServiceAreaModule,
    SupportModule,
    RefundsModule,

    ScheduleModule.forRoot(),
  ],

  providers: [
    NotificationService,
    GlobalLogger,
    ChatLiveGateway,

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
    consumer.apply(HttpMetricsMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
