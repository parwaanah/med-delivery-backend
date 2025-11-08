// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { ConfigService } from '@nestjs/config';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module'; // ✅ import GeoSurgeModule
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'order_assign' }),
    SurgeModule,
    GeoSurgeModule, // ✅ make GeoSurgeService available here
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
