// src/queues/orders.queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrdersQueueService {
  private queue!: Queue;
  private readonly logger = new Logger(OrdersQueueService.name);

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
    const queueName = this.config.get<string>('ORDER_ASSIGN_QUEUE_NAME') || 'order_assign';
    const conn = new IORedis(redisUrl, { enableReadyCheck: true, maxRetriesPerRequest: null });
    this.queue = new Queue(queueName, { connection: conn });
  }

  async addRiderEscalation(orderId: number, delayMs?: number) {
    try {
      await this.queue.add('rider_escalation', { orderId }, { removeOnComplete: true, removeOnFail: false, delay: delayMs ?? 0 });
      this.logger.log(`Enqueued rider_escalation for order ${orderId} delay=${delayMs ?? 0}ms`);
    } catch (err) {
      this.logger.warn('Failed to enqueue rider_escalation', (err as any)?.message ?? err);
      throw err;
    }
  }
}
