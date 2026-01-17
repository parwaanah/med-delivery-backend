// src/queues/order-assign.worker.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { EscalationService } from '../admin/escalation.service';
import { OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class OrderAssignWorker
  implements OnModuleInit, OnModuleDestroy
{
  private worker!: Worker;
  private redisClient!: Redis;
  private readonly logger = new Logger(OrderAssignWorker.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
    private readonly ws: WsGateway,
    private readonly esc: EscalationService,
  ) {}

  onModuleInit() {
    const redisUrl =
      this.config.get<string>('REDIS_URL') ||
      `redis://redis:${this.config.get<number>('REDIS_PORT') ?? 6379}`;

    const queueName =
      this.config.get<string>('ORDER_ASSIGN_QUEUE_NAME') ||
      'order_assign';

    this.redisClient = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    });

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
          },
        });

        if (!order) return;

        // ✅ TYPESAFE ENUM CHECK — FIXED
        if (
          order.riderId ||
          (
            order.status !== OrderStatus.PENDING &&
            order.status !== OrderStatus.ACCEPTED
          )
        ) {
          return;
        }

        const candidates = await this.esc.findCandidatesForOrder(orderId);

        for (const c of candidates) {
          const riderId = Number(c.riderId);
          if (!riderId) continue;

          const assigned = await this.prisma.$transaction(async (tx) => {
            const fresh = await tx.order.findUnique({
              where: { id: orderId },
              select: { riderId: true },
            });
            if (fresh?.riderId) return null;

            await tx.order.update({
              where: { id: orderId },
              data: {
                riderId,
                status: OrderStatus.OUT_FOR_DELIVERY,
              },
            });

            await tx.user.update({
              where: { id: riderId },
              data: { status: 'BUSY' },
            });

            return riderId;
          });

          if (assigned) {
            this.notify.create(
              assigned,
              'ORDER_ASSIGNED',
              `Order #${orderId} assigned`,
              { orderId },
            );

            this.ws.notifyUser(assigned, 'order_assigned', {
              orderId,
            });

            this.ws.notifyUser(order.customerId, 'order_status_update', {
              orderId,
              stage: OrderStatus.OUT_FOR_DELIVERY,
            });

            this.logger.log(
              `Auto-assigned rider ${assigned} → order ${orderId}`,
            );
            return;
          }
        }

        // 🔔 ESCALATE TO ADMINS
        const admins = await this.prisma.user.findMany({
          where: { role: UserRole.ADMIN },
          select: { id: true },
        });

        for (const admin of admins) {
          this.notify.create(
            admin.id,
            'ORDER_ESCALATION',
            `Order #${orderId} requires manual assignment`,
            { orderId },
          );

          this.ws.notifyUser(admin.id, 'order_escalation', {
            orderId,
          });
        }

        this.logger.warn(
          `Order ${orderId} escalated to admins`,
        );
      },
      { connection: this.redisClient },
    );

    this.logger.log('✅ OrderAssignWorker running');
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => {});
    await this.redisClient?.quit().catch(() => {});
    this.logger.log('🛑 OrderAssignWorker stopped');
  }
}
