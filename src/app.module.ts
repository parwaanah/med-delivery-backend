import {
  Module,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, seconds } from '@nestjs/throttler';

// 🧩 Custom Guards & Middleware
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { ErrorLoggerMiddleware } from './common/middleware/error-logger.middleware'; // ✅ Error middleware

// 🧩 Config
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

// 🧩 Core Modules
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PharmaciesModule } from './pharmacies/pharmacies.module';
import { OrdersModule } from './orders/orders.module';
import { MedicinesModule } from './medicines/medicines.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { RidersModule } from './riders/riders.module';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { HealthController } from './health/health.controller';

// 🧩 Shared/Global Modules
import { PrismaModule } from '../prisma/prisma.module';
import { LoggerModule } from './shared/logger/logger.module'; // ✅ Global Winston module

@Module({
  imports: [
    // 🌍 Environment Config + Validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),

    // 🚦 Rate Limiting (Throttler v6)
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: seconds(60), // 1 minute
          limit: 10,        // 10 req per minute per IP
        },
      ],
    }),

    // 🧩 Global Modules
    PrismaModule, // ✅ Prisma everywhere
    LoggerModule, // ✅ Global Winston logger

    // 🧩 Core Business Modules
    UsersModule,
    PharmaciesModule,
    OrdersModule,
    MedicinesModule,
    AuthModule,
    AdminModule,
    RidersModule,
  ],
  controllers: [AppController, HealthController, NotificationsController],
  providers: [
    AppService,
    NotificationsService,

    // 🛡️ Global Throttler Guard with logging
    {
      provide: APP_GUARD,
      useClass: LoggingThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ✅ Apply both middlewares globally
    consumer
      .apply(HttpLoggerMiddleware, ErrorLoggerMiddleware)
      .forRoutes('*');
  }
}
