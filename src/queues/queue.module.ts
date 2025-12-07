// src/queues/queue.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

import { OrderAssignWorker } from './order-assign.worker';

// Required services
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { EscalationService } from '../admin/escalation.service';

import { WsModule } from '../ws/ws.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminModule } from '../admin/admin.module';

import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { SurgeModule } from '../surge/surge.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    forwardRef(() => AdminModule),
    WsModule,

    // Required service modules
    GeoSurgeModule,
    SurgeModule,

    // ======================================
    // ✅ GLOBAL BULLMQ REDIS CONNECTION
    // ======================================
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'redis',
          port: Number(config.get('REDIS_PORT') ?? 6379),
        },
      }),
    }),

    // ======================================
    // ✅ REGISTER QUEUE
    // ======================================
    BullModule.registerQueue({
      name: 'order_assign',
    }),
  ],

  providers: [
    OrderAssignWorker,
    PrismaService,
    NotificationService,
    EscalationService,

    // ======================================
    // ✅ DIRECT QUEUE PROVIDER (BullMQ)
    // ======================================
    {
      provide: 'ORDER_ASSIGN_QUEUE',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Queue('order_assign', {
          connection: {
            host: config.get<string>('REDIS_HOST') || 'redis',
            port: Number(config.get('REDIS_PORT') ?? 6379),
          },
        });
      },
    },
  ],

  exports: ['ORDER_ASSIGN_QUEUE', OrderAssignWorker],
})
export class QueueModule {}
