// src/queues/queue.module.ts
import { Module, Global } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { OrdersProcessor } from './orders.processor';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';

@Global()
@Module({
  providers: [
    // 🧩 Redis provider
    {
      provide: 'REDIS',
      useFactory: (config: ConfigService) => {
        const redisUrl: string = config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
        return new IORedis(redisUrl);
      },
      inject: [ConfigService],
    },

    // 🧩 BullMQ queue provider
    {
      provide: 'ORDER_ASSIGN_QUEUE',
      useFactory: (config: ConfigService) => {
        const connection = {
          connection: {
            host: config.get<string>('REDIS_HOST') || '127.0.0.1',
            port: Number(config.get<string>('REDIS_PORT') || 6379),
          },
        };
        return new Queue('order_assign', connection);
      },
      inject: [ConfigService],
    },

    // 🧩 Core dependencies for worker
    PrismaService,
    NotificationService,
    WsGateway,

    // 🧩 The worker itself
    OrdersProcessor,
  ],
  exports: ['ORDER_ASSIGN_QUEUE', 'REDIS'],
})
export class QueueModule {}
