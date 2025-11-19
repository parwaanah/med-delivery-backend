import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { UtilsModule } from '../utils/utils.module';
import { WsModule } from '../ws/ws.module';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { QueueModule } from '../queues/queue.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    UtilsModule,     // provides PrismaService, NotificationService, etc.
    WsModule,        // WebSocket gateway
    SurgeModule,
    GeoSurgeModule,
    QueueModule,     // provides ORDER_ASSIGN_QUEUE token
    PaymentsModule,  // provides PaymentsService
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    // don't re-provide PrismaService or WsGateway here — provided through UtilsModule / WsModule
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
