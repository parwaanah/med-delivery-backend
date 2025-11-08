// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { QueueModule } from '../queues/queue.module';
import { SurgeModule } from '../surge/surge.module'; // ✅ import SurgeModule
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [
    UtilsModule, // gives Prisma + Notification + Audit
    QueueModule, // gives ORDER_ASSIGN_QUEUE
    SurgeModule, // ✅ provides SurgeService
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PrismaService,
    NotificationService,
    WsGateway,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
