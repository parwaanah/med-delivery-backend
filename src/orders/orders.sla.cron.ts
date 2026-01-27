import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { WsGateway } from '../ws/ws.gateway';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersSlaCron {
  private readonly logger = new Logger(OrdersSlaCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
    private readonly ws: WsGateway,
    private readonly config: ConfigService,
  ) {}

  private slaMinutes() {
    const raw =
      this.config.get<string>('PHARMACY_ACCEPT_SLA_MINUTES') ??
      process.env.PHARMACY_ACCEPT_SLA_MINUTES ??
      '10';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 10;
    return Math.min(Math.max(Math.floor(n), 1), 180);
  }

  @Cron('*/1 * * * *') // every minute
  async handlePharmacyAcceptSla() {
    // Allow disabling for load tests.
    if (process.env.DISABLE_SLA === '1') return;

    const minutes = this.slaMinutes();
    const cutoff = new Date(Date.now() - minutes * 60_000);

    const overdue = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        deletedAt: null,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        customerId: true,
        pharmacyId: true,
        createdAt: true,
      },
      take: 200,
    });

    if (!overdue.length) return;

    for (const o of overdue) {
      try {
        const ageSec = Math.max(
          0,
          Math.floor((Date.now() - o.createdAt.getTime()) / 1000),
        );

        await this.prisma.orderTimeline.create({
          data: {
            orderId: o.id,
            event: 'PHARMACY_SLA_BREACHED',
            data: JSON.stringify({
              pharmacyId: o.pharmacyId,
              slaMinutes: minutes,
              ageSec,
              auto: true,
            }),
          },
        });

        await this.prisma.auditLog.create({
          data: {
            userId: o.pharmacyId,
            action: 'PHARMACY_SLA_BREACH',
            resource: `order:${o.id}`,
            meta: { orderId: o.id, slaMinutes: minutes, ageSec },
          },
        });

        this.notify.create(
          o.pharmacyId,
          'SLA_BREACH',
          `SLA breach: Order #${o.id} pending > ${minutes} minutes`,
          { orderId: o.id, slaMinutes: minutes, ageSec },
        );

        (this.ws as any).notifyAdmins?.('order.sla_breached', {
          orderId: o.id,
          pharmacyId: o.pharmacyId,
          ageSec,
          slaMinutes: minutes,
        });
      } catch (e: any) {
        this.logger.warn(
          `SLA breach processing failed for order ${o.id}: ${e?.message || e}`,
        );
      }
    }

    this.logger.debug(`SLA check processed ${overdue.length} overdue orders`);
  }
}
