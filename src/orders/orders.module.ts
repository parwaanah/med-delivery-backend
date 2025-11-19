// src/orders/orders.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { PaymentsModule } from '../payments/payments.module';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { WsModule } from '../ws/ws.module';

// ✔ Import QueueModule with forwardRef so ORDER_ASSIGN_QUEUE becomes available
import { QueueModule } from '../queues/queue.module';

@Module({
  imports: [
    forwardRef(() => QueueModule),     // ❤️ FIX #1: gives OrdersService access to ORDER_ASSIGN_QUEUE
    PaymentsModule,
    SurgeModule,
    GeoSurgeModule,
    WsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, NotificationService],
  exports: [OrdersService],            // so AdminModule can use OrdersService
})
export class OrdersModule {}
