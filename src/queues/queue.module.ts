// src/queues/queue.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { OrderAssignWorker } from './order-assign.worker';

// Modules required by worker
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { EscalationService } from '../admin/escalation.service';
import { WsModule } from '../ws/ws.module';

// Fix circular dependency
import { OrdersModule } from '../orders/orders.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    forwardRef(() => AdminModule),
    WsModule,

    // BullMQ connection
    BullModule.forRoot({
      connection: {
        host: '127.0.0.1',
        port: 6379,
      },
    }),

    BullModule.registerQueue({
      name: 'order_assign',
    }),
  ],

  providers: [
    OrderAssignWorker,
    PrismaService,
    NotificationService,

    {
      provide: 'ORDER_ASSIGN_QUEUE',
      useFactory: () => {
        return new Queue('order_assign', {
          connection: { host: '127.0.0.1', port: 6379 },
        });
      },
    },
  ],

  exports: [
    'ORDER_ASSIGN_QUEUE',
    OrderAssignWorker,
  ],
})
export class QueueModule {}
