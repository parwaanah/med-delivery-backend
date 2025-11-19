// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'order_assign' }),
    SurgeModule,
    GeoSurgeModule,
    PaymentsModule,          // <-- REQUIRED
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PrismaService,
    NotificationService,
    WsGateway,
    ConfigService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
