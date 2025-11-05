import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Queue, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';

@WebSocketGateway({ namespace: 'queue-live', cors: { origin: '*' } })
export class QueueLiveGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private redisConnection: Redis;
  private queues: Record<string, Queue> = {};

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  async afterInit() {
    // Define all monitored queues
    this.queues = {
      notifications: new Queue('notifications', { connection: this.redisConnection }),
      orders: new Queue('orders', { connection: this.redisConnection }),
    };

    // Subscribe to all queue events
    for (const [name, queue] of Object.entries(this.queues)) {
      const events = new QueueEvents(name, { connection: this.redisConnection });

      // Broadcast full job data on events
      events.on('completed', async ({ jobId }) => {
        const job = await queue.getJob(jobId);
        if (job) this.emitJobEvent('completed', name, job);
      });

      events.on('failed', async ({ jobId, failedReason }) => {
        const job = await queue.getJob(jobId);
        if (job) this.emitJobEvent('failed', name, job, failedReason);
      });

      events.on('active', async ({ jobId }) => {
        const job = await queue.getJob(jobId);
        if (job) this.emitJobEvent('active', name, job);
      });

      events.on('waiting', async ({ jobId }) => {
        const job = await queue.getJob(jobId);
        if (job) this.emitJobEvent('waiting', name, job);
      });

      events.on('progress', async ({ jobId, data }) => {
        const job = await queue.getJob(jobId);
        if (job) this.emitJobEvent('progress', name, job, data);
      });
    }

    console.log('✅ QueueLiveGateway with detailed job events initialized');
  }

  // Emit real-time queue summary and job list
  private async emitJobEvent(
    event: string,
    queueName: string,
    job: Job,
    extraData?: any,
  ) {
    const payload = {
      queue: queueName,
      event,
      job: {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        timestamp: new Date(job.timestamp).toISOString(),
        failedReason: job.failedReason,
        returnValue: job.returnvalue,
      },
      extra: extraData,
      at: new Date().toISOString(),
    };

    // Emit job event
    this.server.emit('job_event', payload);

    // Emit overall queue stats update
    await this.emitQueueSummary();
  }

  private async emitQueueSummary() {
    const data: Record<string, any> = {};
    for (const [name, queue] of Object.entries(this.queues)) {
      data[name] = await queue.getJobCounts();
    }

    this.server.emit('queue_summary', {
      timestamp: new Date().toISOString(),
      queues: data,
    });
  }
}
