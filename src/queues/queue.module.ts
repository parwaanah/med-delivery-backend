import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { OrdersProcessor } from './orders.processor';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS',
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        return new IORedis(redisUrl, { enableReadyCheck: true });
      },
      inject: [ConfigService],
    },

    {
      provide: 'ORDER_ASSIGN_QUEUE',
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
        const bullConn = new IORedis(redisUrl, {
          enableReadyCheck: true,
          maxRetriesPerRequest: null,
        });
        return new Queue('order_assign', { connection: bullConn });
      },
      inject: [ConfigService],
    },

    PrismaService,
    NotificationService,
    WsGateway,
    OrdersProcessor,
  ],
  exports: ['ORDER_ASSIGN_QUEUE', 'REDIS'],
})
export class QueueModule {}
