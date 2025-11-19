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

    this.redisClient = new IORedis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'order_assign',
      async (job: Job) => {
        try {
          const { orderId } = job.data;
          if (!orderId) return;

          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, riderId: true, status: true, pharmacyId: true, customerId: true }
          });

          if (!order) return;

          // If still no rider after delay → escalate
          if (!order.riderId && order.status === 'PENDING') {
            const admin = await this.prisma.user.findFirst({
              where: { role: 'ADMIN' },
              select: { id: true }
            });

            if (admin) {
              await this.notify.create(
                admin.id,
                'ORDER_ESCALATION',
                `⚠ No rider accepted order #${orderId} within the expected time.`,
                { orderId }
              );

              this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
            }

            this.logger.warn(
              `⏰ Escalation triggered for order ${orderId} — no rider accepted.`
            );
          }
        } catch (err) {
          this.logger.error('Worker job failed', err);
        }
      },
      {
        connection: this.redisClient,
      },
    );

    this.worker.on('completed', (job) =>
      this.logger.log(`Order escalation check completed for job ${job.id}`)
    );
    this.worker.on('failed', (job, err) =>
      this.logger.warn(`Escalation job failed ${job?.id}: ${err?.message}`)
    );

    this.logger.log('✅ OrdersProcessor worker started (order_assign)');
  }

  async onModuleDestroy() {
    try {
      await this.worker.close();
    } catch {}
    try {
      await this.redisClient.quit();
    } catch {}
  }
}
