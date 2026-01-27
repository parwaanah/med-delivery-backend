import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../utils/prisma.service';
import { RiderPaymentsService } from './rider-payments.service';

@Injectable()
export class RiderLedgerReconcileCron {
  private readonly logger = new Logger(RiderLedgerReconcileCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riderPayments: RiderPaymentsService,
  ) {}

  // Every 10 minutes: ensure missing rider earnings are created and refunded orders are clawed back.
  @Cron('*/10 * * * *')
  async reconcile() {
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    try {
      const delivered: any[] = await this.prisma.order.findMany(({
        where: {
          deliveredAt: { gte: since },
          riderId: { not: null },
          OR: [
            { deliveryProofUrl: { not: null } },
            { deliverySignatureUrl: { not: null } },
            { deliveryOtp: { not: null } },
          ],
        },
        select: {
          id: true,
          riderEarning: { select: { id: true } },
        },
        take: 500,
      } as any));

      const missing = delivered.filter((o) => !o?.riderEarning).map((o) => o.id);
      for (const orderId of missing) {
        await this.riderPayments.ensureDeliveryEarningForOrder(orderId);
      }

      const refundedTxs = await this.prisma.transaction.findMany({
        where: {
          status: 'REFUNDED',
          createdAt: { gte: since },
          orderId: { not: null },
        },
        select: { id: true, orderId: true, amount: true },
        take: 500,
      });

      for (const tx of refundedTxs) {
        const orderId = tx.orderId != null ? Number(tx.orderId) : NaN;
        if (!Number.isFinite(orderId)) continue;
        await this.riderPayments.handleRefundForOrder(orderId, {
          transactionId: tx.id,
          amount: Number(tx.amount) / 100,
          by: 'SYSTEM',
        });
      }

      if (missing.length || refundedTxs.length) {
        this.logger.log(
          `Reconcile ok: created=${missing.length} refundsChecked=${refundedTxs.length}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Reconcile failed: ${msg}`);
    }
  }
}
