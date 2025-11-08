// src/queues/orders.processor.ts
import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class OrdersProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;
  private readonly logger = new Logger(OrdersProcessor.name);
  private redisClient!: IORedis;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';

    // Worker connection MUST use maxRetriesPerRequest: null
    this.redisClient = new IORedis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'order_assign',
      async (job: Job) => {
        try {
          const { orderId } = job.data as { orderId: number };
          if (!orderId) return;

          const order = await this.prisma.order.findUnique({ where: { id: orderId } });
          if (!order) return;

          if (!order.riderId && (order.status === 'ACCEPTED' || order.status === 'ASSIGNED')) {
            const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
            if (admin) {
              await this.notify.create(
                admin.id,
                'ORDER_ESCALATION',
                `No rider accepted order ${orderId} within timeframe`,
                { orderId },
              );
              this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
            }
          }
        } catch (err) {
          this.logger.error('Worker job failed', err as any);
        }
      },
      {
        connection: this.redisClient,
      },
    );

    this.worker.on('completed', (job) => this.logger.log(`Worker completed job ${job.id}`));
    this.worker.on('failed', (job, err) => this.logger.warn(`Worker failed job ${job?.id}: ${err?.message}`));
    this.logger.log('✅ OrdersProcessor worker started (order_assign)');
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
    } catch {
      // ignore
    }
    try {
      await this.redisClient?.quit();
    } catch {
      // ignore
    }
    this.logger.log('🧹 OrdersProcessor shut down');
  }
}
