// src/queues/order-assign.worker.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, Job, Queue } from 'bullmq';
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
  private dlq!: Queue;
  private readonly logger = new Logger(OrderAssignWorker.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
    private readonly ws: WsGateway,
    private readonly esc: EscalationService,
  ) {}

  private offerLockKey(orderId: number) {
    return `order:offer_lock:${orderId}`;
  }

  private offerRoundKey(orderId: number) {
    return `order:offer_round:${orderId}`;
  }

  private offerTtlSec() {
    const n = Number(
      this.config.get('RIDER_OFFER_TTL_SEC') ||
        process.env.RIDER_OFFER_TTL_SEC ||
        30,
    );
    if (!Number.isFinite(n)) return 30;
    return Math.min(Math.max(Math.floor(n), 10), 300);
  }

  private offerBatchSize() {
    const n = Number(
      this.config.get('RIDER_OFFER_BATCH') ||
        process.env.RIDER_OFFER_BATCH ||
        5,
    );
    if (!Number.isFinite(n)) return 5;
    return Math.min(Math.max(Math.floor(n), 1), 20);
  }

  private maxRounds() {
    const n = Number(
      this.config.get('RIDER_OFFER_MAX_ROUNDS') ||
        process.env.RIDER_OFFER_MAX_ROUNDS ||
        3,
    );
    if (!Number.isFinite(n)) return 3;
    return Math.min(Math.max(Math.floor(n), 1), 10);
  }

  onModuleInit() {
    const redisUrl =
      this.config.get<string>('REDIS_URL') ||
      `redis://redis:${this.config.get<number>('REDIS_PORT') ?? 6379}`;

    const queueName =
      this.config.get<string>('ORDER_ASSIGN_QUEUE_NAME') || 'order_assign';

    this.redisClient = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    });

    this.dlq = new Queue('dead_letter', { connection: this.redisClient as any });

    this.worker = new Worker(
      queueName,
      async (job: Job) => {
        if (job.name !== 'rider_escalation') return;

        const orderId = Number(job.data?.orderId);
        if (!orderId) return;

        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            riderId: true,
            customerId: true,
            pharmacyId: true,
          },
        });

        if (!order) return;

        // Only dispatch offers if no rider yet and order is in a rider-dispatchable state.
        if (
          order.riderId ||
          order.status !== OrderStatus.ASSIGNED
        ) {
          return;
        }

        const ttlSec = this.offerTtlSec();
        const lockOk = await this.redisClient.set(
          this.offerLockKey(orderId),
          String(Date.now()),
          'EX',
          ttlSec,
          'NX',
        );
        if (!lockOk) return;

        const round = await this.redisClient.incr(this.offerRoundKey(orderId));
        // Prevent unbounded growth of round counters in Redis.
        try {
          await this.redisClient.expire(this.offerRoundKey(orderId), 24 * 60 * 60);
        } catch {}
        if (round > this.maxRounds()) {
          const admins = await this.prisma.user.findMany({
            where: { role: UserRole.ADMIN },
            select: { id: true },
          });

          for (const admin of admins) {
            this.notify.create(
              admin.id,
              'ORDER_ESCALATION',
              `Order #${orderId} requires manual rider assignment`,
              { orderId, reason: 'NO_RIDER_ACCEPT', rounds: round },
            );

            this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
          }

          this.ws.notifyAdmins('order.escalated', {
            orderId,
            reason: 'NO_RIDER_ACCEPT',
            rounds: round,
          });
          return;
        }

        const candidates = await this.esc.findCandidatesForOrder(orderId);
        const batch = candidates.slice(0, this.offerBatchSize());
        const expiresAt = new Date(Date.now() + ttlSec * 1000);

        for (const c of batch) {
          const riderId = Number((c as any).riderId);
          if (!riderId) continue;

          await this.prisma.orderOffer.create(
            ({
              data: {
                orderId,
                pharmacyId: order.pharmacyId,
                riderId,
                offeredTo: 'RIDER',
                status: 'PENDING',
                score: Number((c as any).score ?? 0),
                expiresAt,
              },
            } as any),
          );

          this.notify.create(
            riderId,
            'ORDER_OFFER',
            `New delivery offer for order #${orderId}`,
            { orderId, expiresAt, round, score: (c as any).score ?? null },
          );

          this.ws.notifyUser(riderId, 'order.offer', {
            orderId,
            expiresAt,
            round,
            score: (c as any).score ?? null,
          });
        }

        if (batch.length === 0) {
          const admins = await this.prisma.user.findMany({
            where: { role: UserRole.ADMIN },
            select: { id: true },
          });

          for (const admin of admins) {
            this.notify.create(
              admin.id,
              'ORDER_ESCALATION',
              `Order #${orderId} requires manual assignment`,
              { orderId, reason: 'NO_CANDIDATES', round },
            );

            this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
          }

          this.ws.notifyAdmins('order.escalated', {
            orderId,
            reason: 'NO_CANDIDATES',
            round,
          });

          this.logger.warn(`Order ${orderId} escalated to admins`);
        }
      },
      { connection: this.redisClient },
    );

    this.worker.on('failed', (job, err) =>
      (async () => {
        try {
          await this.dlq.add(
            'dead_letter',
            {
              queue: queueName,
              jobId: job?.id ?? null,
              name: job?.name ?? null,
              data: job?.data ?? null,
              error: err?.message ?? String(err),
              at: new Date().toISOString(),
            },
            { removeOnComplete: true, removeOnFail: false },
          );
        } catch {}
      })(),
    );

    this.logger.log('OrderAssignWorker running (offer engine)');
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => {});
    await this.dlq?.close().catch(() => {});
    await this.redisClient?.quit().catch(() => {});
    this.logger.log('OrderAssignWorker stopped');
  }
}
