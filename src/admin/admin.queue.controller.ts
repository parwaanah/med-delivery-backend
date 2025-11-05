import { Controller, Get, UseGuards } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminQueueController {
  private readonly redisConnection: Redis;
  private readonly queues: Record<string, Queue> = {};

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queues.notifications = new Queue('notifications', { connection: this.redisConnection });
    this.queues.orders = new Queue('orders', { connection: this.redisConnection });
  }

  @Get('status')
  async getQueueStatus() {
    const summary: Record<string, any> = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      const counts = await queue.getJobCounts();
      summary[name] = {
        active: counts.active,
        waiting: counts.waiting,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      queues: summary,
    };
  }
}
