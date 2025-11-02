import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PharmaciesModule } from './pharmacies/pharmacies.module';
import { RidersModule } from './riders/riders.module';
import { OrdersModule } from './orders/orders.module';
import { QueueModule } from './queues/queue.module';
import { GlobalLogger } from './common/logger/global-logger.service';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { WsGateway } from './ws/ws.gateway';
import { NotificationService } from './utils/notification.service';
import { UtilsModule } from './utils/utils.module'; // ✅ import here

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UtilsModule, // ✅ provides Prisma + Audit
    AuthModule,
    UsersModule,
    PharmaciesModule,
    RidersModule,
    OrdersModule,
    QueueModule,
  ],
  providers: [WsGateway, NotificationService, GlobalLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
