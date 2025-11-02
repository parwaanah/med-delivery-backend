// src/queues/orders.processor.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class OrdersProcessor implements OnModuleInit {
  private worker!: Worker;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private notify: NotificationService,
    private ws: WsGateway,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get('REDIS_URL') || 'redis://127.0.0.1:6379';
    this.worker = new Worker(
      'order_assign',
      async (job: Job) => {
        // job.data: { orderId }
        const { orderId } = job.data as { orderId: number };
        // if order still unassigned after timeout => escalate
        const order = await this.prisma.order.findUnique({ where: { id: orderId }});
        if (!order) return;

        if (!order.riderId && (order.status === 'ACCEPTED' || order.status === 'ASSIGNED')) {
          // create admin notification
          const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' }});
          if (admin) {
            await this.notify.create(admin.id, 'ORDER_ESCALATION', `No rider accepted order ${orderId} within timeframe`, { orderId });
            this.ws.notifyUser(admin.id, 'order_escalation', { orderId });
          }
        }
      },
      { connection: redisUrl }
    );
  }
}
