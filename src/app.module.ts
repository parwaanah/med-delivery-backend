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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ✅ Serve static dashboard from /public
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/', // base URL path
    }),

    UtilsModule,
    AuthModule,
    UsersModule,
    PharmaciesModule,
    RidersModule,
    OrdersModule,
    QueueModule,
    AdminModule,
    WsModule,
  ],
  providers: [NotificationService, GlobalLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
