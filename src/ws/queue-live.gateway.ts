// src/queues/queue-live.gateway.ts
import { WebSocketGateway, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

@WebSocketGateway({ namespace: '/queue-live', cors: { origin: '*' } })
export class QueueLiveGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private redis!: IORedis;
  private queues: Record<string, Queue> = {};

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // REQUIRED for BullMQ
      enableReadyCheck: false,
      // optional: nice to have retry/backoff tuned for queue watchers
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
  }

  async afterInit() {
    // Build monitored queues using the same ioredis instance
    this.queues = {
      notifications: new Queue('notifications', { connection: this.redis }),
      orders: new Queue('orders', { connection: this.redis }),
    };

    for (const [name, queue] of Object.entries(this.queues)) {
      const events = new QueueEvents(name, { connection: this.redis });

      // helper to emit events safely
      const send = async (event: string, jobId: string, extra?: any) => {
        try {
          const job = await queue.getJob(jobId);
          if (!job) return;
          this.server.emit('job_event', {
            queue: name,
            event,
            job: {
              id: job.id,
              name: job.name,
              data: job.data,
              progress: job.progress,
              attemptsMade: job.attemptsMade,
            },
            extra,
            at: new Date().toISOString(),
          });
          // update summary (best-effort)
          await this.emitQueueSummary();
        } catch (err) {
          // do not crash gateway on single job failure
          console.warn('QueueLive send error', err);
        }
      };

      events.on('active', ({ jobId }) => send('active', jobId));
      events.on('waiting', ({ jobId }) => send('waiting', jobId));
      events.on('progress', ({ jobId, data }) => send('progress', jobId, data));
      events.on('completed', ({ jobId }) => send('completed', jobId));
      events.on('failed', ({ jobId, failedReason }) => send('failed', jobId, failedReason));
    }

    console.log('✅ QueueLiveGateway initialized (anonymous safe)');
  }

  private async emitQueueSummary() {
    const summary: Record<string, any> = {};
    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        summary[name] = await queue.getJobCounts();
      } catch {
        summary[name] = { error: 'unavailable' };
      }
    }
    this.server.emit('queue_summary', {
      timestamp: new Date().toISOString(),
      queues: summary,
    });
  }
}
