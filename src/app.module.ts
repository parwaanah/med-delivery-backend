import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { PaymentModule } from './payment/payment.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ReportsModule } from './reports/reports.module';
import { ScheduleModule } from '@nestjs/schedule';

import { ChatLiveGateway } from './ws/chat-live.gateway';
import { ChatModule } from './chat/chat.module';
import { CacheModule } from './cache/cache.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Serve static dashboards from /public
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
    }),

    // Core & Enhanced Modules
    UtilsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PharmaciesModule,
    RidersModule,
    OrdersModule,
    QueueModule,
    AdminModule,
    WsModule,
    SurgeModule,
    GeoSurgeModule,
    PaymentModule,
    WebhooksModule,
    ReportsModule,
    ScheduleModule.forRoot(),

    // Phase 4 add-ons
    ChatModule,
    CacheModule,
    MetricsModule,
  ],
  providers: [NotificationService, GlobalLogger, ChatLiveGateway],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
