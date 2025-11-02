import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaService } from './utils/prisma.service';
import { PharmaciesModule } from './pharmacies/pharmacies.module';
import { RidersModule } from './riders/riders.module';
import { OrdersModule } from './orders/orders.module';
import { QueueModule } from './queues/queue.module';
import { WsGateway } from './ws/ws.gateway';
import { NotificationService } from './utils/notification.service';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { GlobalLogger } from './common/logger/global-logger.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
  throttlers: [
    {
      ttl: 60,      // ⏱️ Time window in seconds
      limit: 30,    // 🚦 Max number of requests per user/IP
    },
  ],
}),
    AuthModule,
    UsersModule,
    PharmaciesModule,
    RidersModule,
    OrdersModule,
    QueueModule,
  ],
  providers: [PrismaService, WsGateway, NotificationService, GlobalLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
