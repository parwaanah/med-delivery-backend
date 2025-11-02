// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { QueueModule } from '../queues/queue.module';
import { OrdersProcessor } from '../queues/orders.processor';

@Module({
  imports: [QueueModule],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, NotificationService, WsGateway, OrdersProcessor],
})
export class OrdersModule {}
