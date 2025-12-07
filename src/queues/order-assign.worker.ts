// src/queues/order-assign.worker.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { EscalationService } from '../admin/escalation.service';
import { OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class OrderAssignWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;
  private redisClient!: Redis;
  private readonly logger = new Logger(OrderAssignWorker.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
    private esc: EscalationService,
  ) {}

  onModuleInit() {
    // ALWAYS use Docker Redis host → redis://redis:6379
    const redisUrl =
      this.config.get<string>('REDIS_URL') ||
      `redis://redis:${this.config.get<number>('REDIS_PORT') ?? 6379}`;

    const queueName = this.config.get<string>('ORDER_ASSIGN_QUEUE_NAME') || 'order_assign';

    this.redisClient = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      queueName,
      async (job: Job) => {
        try {
          this.logger.log(
            `Processing job ${job.id} (${job.name}) data=${JSON.stringify(job.data)}`
          );

          if (job.name === 'rider_escalation') {
            const { orderId } = job.data;
            if (!orderId) return;

            const order = await this.prisma.order.findUnique({
              where: { id: Number(orderId) },
              select: { id: true, status: true, riderId: true, pharmacyId: true, customerId: true },
            });

            if (!order) {
              this.logger.warn(`Order ${orderId} not found — skipping`);
              return;
            }

            if (!['PENDING', 'ACCEPTED'].includes(String(order.status))) {
              this.logger.log(`Order ${orderId} status=${order.status} — skipping`);
              return;
            }

            if (order.riderId) {
              this.logger.log(`Order ${orderId} already has rider ${order.riderId}`);
              return;
            }

            const autoAssign =
              String(this.config.get('AUTO_ASSIGN_RIDER') ?? 'false').toLowerCase() ===
              'true';

            const candidates = await this.esc.findCandidatesForOrder(
              Number(orderId),
              Number(this.config.get('RIDER_SEARCH_KM') || 5),
              20,
            );

            if (autoAssign && candidates?.length) {
              for (const c of candidates) {
                const riderId = Number(c.riderId);
                if (!riderId || isNaN(riderId)) continue;

                try {
                  const result = await this.prisma.$transaction(async (tx) => {
                    const rider = await tx.user.findUnique({
                      where: { id: riderId },
                      select: { id: true, status: true },
                    });
                    if (!rider || rider.status !== 'AVAILABLE') return null;

                    const ord = await tx.order.findUnique({
                      where: { id: Number(orderId) },
                      select: { riderId: true, customerId: true },
                    });
                    if (!ord || ord.riderId) return null;

                    await tx.order.update({
                      where: { id: Number(orderId) },
                      data: { riderId, status: OrderStatus.OUT_FOR_DELIVERY },
                    });

                    await tx.user.update({
                      where: { id: riderId },
                      data: { status: 'BUSY' },
                    });

                    return {
                      riderId,
                      orderId: Number(orderId),
                      customerId: ord.customerId,
                    };
                  });

                  if (result) {
                    this.notify.create(
                      result.riderId,
                      'ORDER_ASSIGNED',
                      `You were assigned to order #${result.orderId}`,
                      { orderId: result.orderId },
                    );
                    this.ws.notifyUser(result.riderId, 'order_assigned', {
                      orderId: result.orderId,
                    });

                    this.notify.create(
                      result.customerId,
                      'ORDER_OUT_FOR_DELIVERY',
                      `Your order #${result.orderId} is out for delivery`,
                      { orderId: result.orderId },
                    );
                    this.ws.notifyUser(result.customerId, 'order_status_update', {
                      orderId: result.orderId,
                      stage: 'OUT_FOR_DELIVERY',
                    });

                    this.logger.log(
                      `Auto-assigned rider ${result.riderId} -> order ${result.orderId}`
                    );
                    return;
                  }
                } catch (err) {
                  this.logger.warn(
                    `Auto-assign failed rider=${riderId} order=${orderId}: ${
                      (err as any)?.message ?? err
                    }`,
                  );
                }
              }
            }

            const admins = await this.prisma.user.findMany({
              where: { role: UserRole.ADMIN },
              select: { id: true },
            });

            for (const a of admins) {
              await this.notify.create(
                a.id,
                'ORDER_ESCALATION',
                `No rider accepted order #${orderId}`,
                { orderId },
              );
              this.ws.notifyUser(a.id, 'order_escalation', { orderId });
            }

            this.logger.warn(`Escalation sent for order ${orderId}`);
          }
        } catch (err) {
          this.logger.error(
            `Job ${job.id} (${job.name}) failed: ${(err as any)?.message ?? err}`
          );
          throw err;
        }
      },
      { connection: this.redisClient },
    );

    this.worker.on('completed', (job) =>
      this.logger.log(`Escalation job completed ${job.id} (${job.name})`)
    );
    this.worker.on('failed', (job, err) =>
      this.logger.warn(`Escalation job failed ${job?.id}: ${err?.message}`)
    );

    this.logger.log(`✅ OrderAssignWorker started (queue=${queueName})`);
  }

  async onModuleDestroy() {
    await this.worker.close().catch(() => {});
    await this.redisClient.quit().catch(() => {});
    this.logger.log('🛑 OrderAssignWorker stopped');
  }
}
