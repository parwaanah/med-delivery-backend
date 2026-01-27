import { Controller, Get } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('admin/queue')
export class AdminQueueController {
  private redis: Redis;
  private queues: Record<string, Queue> = {};

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://redis:6379';
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
    this.queues = {
      notifications: new Queue('notifications', { connection: this.redis }),
      orders: new Queue('orders', { connection: this.redis }),
      order_assign: new Queue('order_assign', { connection: this.redis }),
      dead_letter: new Queue('dead_letter', { connection: this.redis }),
    };
  }

  @Get('status')
  @Public() // ✅ no JWT required
  async getQueueStatus() {
    const result: Record<string, any> = {};
    for (const [name, q] of Object.entries(this.queues)) {
      try {
        const c = await q.getJobCounts();
        result[name] = {
          active: c.active ?? 0,
          waiting: c.waiting ?? 0,
          completed: c.completed ?? 0,
          failed: c.failed ?? 0,
          delayed: c.delayed ?? 0,
        };
      } catch (err) {
        result[name] = { error: (err as Error).message };
      }
    }
    return { timestamp: new Date().toISOString(), queues: result };
  }
}
