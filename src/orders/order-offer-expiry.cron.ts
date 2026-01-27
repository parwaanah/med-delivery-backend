import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderOfferExpiryCron {
  private readonly logger = new Logger(OrderOfferExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject('ORDER_ASSIGN_QUEUE') private readonly orderAssignQueue: Queue,
  ) {}

  private takeLimit() {
    const n = Number(this.config.get('OFFER_EXPIRY_SCAN_LIMIT') || 200);
    if (!Number.isFinite(n)) return 200;
    return Math.min(Math.max(Math.floor(n), 20), 1000);
  }

  @Cron('*/1 * * * *') // every minute
  async expireOffers() {
    const now = new Date();
    const offers = await this.prisma.orderOffer.findMany(({
      where: {
        offeredTo: 'RIDER',
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      select: { id: true, orderId: true },
      take: this.takeLimit(),
      orderBy: { expiresAt: 'asc' },
    } as any));

    if (!offers.length) return;

    const orderIds = Array.from(new Set(offers.map((o) => Number(o.orderId))));

    await this.prisma.orderOffer.updateMany(({
      where: { id: { in: offers.map((o) => o.id) } },
      data: {
        status: 'EXPIRED',
        respondedAt: now,
        rejectReason: 'TTL_EXPIRED',
      },
    } as any));

    for (const orderId of orderIds) {
      // If there is no rider yet and no pending offers remain, re-dispatch.
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, riderId: true, status: true },
      });
      if (!order || order.riderId) continue;
      if (
        order.status !== OrderStatus.ASSIGNED
      ) {
        continue;
      }

      const pending = await this.prisma.orderOffer.count(({
        where: {
          orderId,
          offeredTo: 'RIDER',
          status: 'PENDING',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      } as any));
      if (pending > 0) continue;

      const delay =
        Number(this.config.get('ESCALATION_MINUTES') || 1) * 60 * 1000;
      await this.orderAssignQueue.add(
        'rider_escalation',
        { orderId },
        { delay },
      );
    }

    this.logger.debug(`Expired ${offers.length} rider offers`);
  }
}
