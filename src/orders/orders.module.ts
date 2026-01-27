// src/orders/orders.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PharmacyOrdersController } from './pharmacy-orders.controller';
import { OrdersSlaCron } from './orders.sla.cron';
import { OrderOfferExpiryCron } from './order-offer-expiry.cron';
import { OrdersStageSlaCron } from './orders.stage-sla.cron';
import { OrderLifecycleService } from './order-lifecycle.service';

import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { PaymentsModule } from '../payments/payments.module';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { WsModule } from '../ws/ws.module';
import { RidersModule } from '../riders/riders.module';
import { ServiceAreaModule } from '../service-area/service-area.module';

// ✔ Import QueueModule with forwardRef so ORDER_ASSIGN_QUEUE becomes available
import { QueueModule } from '../queues/queue.module';

@Module({
  imports: [
    forwardRef(() => QueueModule),     // ❤️ FIX #1: gives OrdersService access to ORDER_ASSIGN_QUEUE
    PaymentsModule,
    SurgeModule,
    GeoSurgeModule,
    WsModule,
    ServiceAreaModule,
    forwardRef(() => RidersModule),
  ],
  controllers: [OrdersController, PharmacyOrdersController],
  providers: [
    OrdersService,
    OrderLifecycleService,
    OrdersSlaCron,
    OrderOfferExpiryCron,
    OrdersStageSlaCron,
    PrismaService,
    NotificationService,
  ],
  exports: [OrdersService],            // so AdminModule can use OrdersService
})
export class OrdersModule {}
