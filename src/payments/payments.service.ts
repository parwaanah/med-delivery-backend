import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
import { OrderStatus } from '@prisma/client';
import { AuditService } from '../utils/audit.service';
import { NotificationService } from '../utils/notification.service';
import { RiderPaymentsService } from '../riders/rider-payments.service';
import { LockService } from '../utils/lock.service';
import { badRequest } from '../common/api-error';
import { AnalyticsService } from '../utils/analytics.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
    private audit: AuditService,
    private notify: NotificationService,
    private analytics: AnalyticsService,
    private riderPayments: RiderPaymentsService,
    private lock: LockService,
  ) {}

  // --------------------------------------------------------
  // Create Payment Order
  // --------------------------------------------------------
  async createPaymentForOrder(orderId: number, customerId: number) {
    const order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: ({
        id: true,
        customerId: true,
        pharmacyId: true,
        totalPrice: true,
        status: true,
        paymentStatus: true,
        paymentMode: true,
      } as any),
    });

    if (!order) throw new BadRequestException('Order not found');
    if (Number(order.customerId) !== Number(customerId)) {
      throw new BadRequestException('Not your order');
    }

    const paymentStatus = String(order.paymentStatus || 'UNPAID').toUpperCase();
    if (paymentStatus === 'PAID') return { ok: true, already: true };
    if (paymentStatus !== 'REQUESTED') {
      badRequest('PAYMENT_NOT_REQUESTED', 'Payment not requested for this order yet', {
        paymentStatus,
      });
    }

    const ttlMin = Number(process.env.PAYMENT_REQUEST_TTL_MINUTES || 30);
    const ttlMs = Number.isFinite(ttlMin) && ttlMin > 0 ? ttlMin * 60_000 : 30 * 60_000;
    const requestedAtRaw = (order as any)?.paymentRequestedAt;
    const requestedAt = requestedAtRaw ? new Date(requestedAtRaw) : null;
    if (requestedAt && Date.now() - requestedAt.getTime() > ttlMs) {
      badRequest('PAYMENT_REQUEST_EXPIRED', 'Payment request expired. Please refresh the order.', {
        requestedAt,
        ttlMinutes: ttlMin,
      });
    }

    // Pay-after-acceptance contract: only allow payment after pharmacy acceptance.
    // Pay-first contract: allow paying immediately while order is pending.
    const payMode = String(order.paymentMode || '').toUpperCase();
    const st = String(order.status || '').toUpperCase();

    const isPayFirst = payMode === 'PAY_FIRST';
    if (isPayFirst) {
      if (
        st !== String(OrderStatus.PENDING) &&
        st !== String(OrderStatus.ACCEPTED) &&
        st !== String(OrderStatus.ASSIGNED)
        ) {
          badRequest('ORDER_STATUS_INVALID', `Cannot pay in status ${order.status}`, {
            status: order.status,
          });
        }
    } else {
      if (st !== String(OrderStatus.ACCEPTED) && st !== String(OrderStatus.ASSIGNED)) {
        badRequest('ORDER_STATUS_INVALID', `Cannot pay in status ${order.status}`, {
          status: order.status,
        });
      }
    }

    // LOADTEST MODE
    if (process.env.LOADTEST_MODE === 'true') {
      const tx = await this.prisma.transaction.create({
        data: {
          orderId,
          provider: 'mock',
          providerOrder: `mock_${orderId}`,
          amount: Number(order.totalPrice) * 100,
          currency: 'INR',
          status: 'SUCCESS',
        },
      });

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: ({ paymentStatus: 'PAID', paidAt: new Date() } as any),
      });

      await this.prisma.orderTimeline.create({
        data: {
          orderId,
          event: 'PAYMENT_CAPTURED',
          data: JSON.stringify({
            transactionId: tx.id,
            provider: tx.provider,
            amount: Number(tx.amount) / 100,
            currency: tx.currency,
            mock: true,
          }),
        },
      });

      await this.notify.createDomainEvent(
        updatedOrder.customerId,
        'payment.captured',
        `Payment captured for order #${orderId}`,
        {
          orderId,
          transactionId: tx.id,
          amount: Number(tx.amount) / 100,
          currency: tx.currency,
          mock: true,
        },
      );

      if ((updatedOrder as any).pharmacyId) {
        await this.notify.createDomainEvent(
          (updatedOrder as any).pharmacyId,
          'payment.captured',
          `Payment captured for order #${orderId}`,
          {
            orderId,
            transactionId: tx.id,
            amount: Number(tx.amount) / 100,
            currency: tx.currency,
            mock: true,
          },
        );
      }

      return { mock: true, transaction: tx };
    }

    const amountPaise = Math.round(Number(order.totalPrice) * 100);
    const rzpOrder = await this.razorpay.createOrder(
      amountPaise,
      'INR',
      `order_${orderId}`,
    );

    const tx = await this.prisma.transaction.create({
      data: {
        orderId,
        provider: 'razorpay',
        providerOrder: rzpOrder.id,
        amount: amountPaise,
        currency: 'INR',
        status: 'CREATED',
      },
    });

    return { razorpayOrder: rzpOrder, transaction: tx };
  }

  // --------------------------------------------------------
  // WEBHOOK HANDLER (RESTORED)
  // --------------------------------------------------------
  async handleWebhookEvent(event: any) {
    const type = event?.event;

    switch (type) {
      case 'payment.authorized':
      case 'payment.captured':
        return this.handlePaymentSuccess(event.payload.payment.entity);
      case 'payment.failed':
        return this.handlePaymentFailed(event.payload.payment.entity);
      default:
        this.logger.warn(`Unhandled webhook event: ${type}`);
    }
  }

  private async handlePaymentSuccess(payment: any) {
    const providerOrder = payment.order_id;
    if (!providerOrder) return;

    const tx = await this.prisma.transaction.findFirst({
      where: { providerOrder },
    });
    if (!tx) return;

    // Idempotent: if already SUCCESS, do not re-emit domain events.
    if (tx.status === 'SUCCESS') {
      return;
    }

    const updatedTx = await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        providerPayment: payment.id,
        status: 'SUCCESS',
        method: payment.method,
        rawData: JSON.parse(JSON.stringify(payment)),
      },
    });

    if (!tx.orderId) return;

    const order: any = await this.prisma.order.findUnique({
      where: { id: tx.orderId },
      select: ({ id: true, status: true, customerId: true, pharmacyId: true, paymentStatus: true } as any),
    });
    if (!order) return;

    // update paymentStatus to PAID (idempotent)
    if (String((order as any).paymentStatus || '').toUpperCase() !== 'PAID') {
      await this.prisma.order.update({
        where: { id: tx.orderId },
        data: ({ paymentStatus: 'PAID', paidAt: new Date() } as any),
      });

      await this.prisma.orderTimeline.create({
        data: {
          orderId: tx.orderId,
          event: 'PAYMENT_CAPTURED',
          data: JSON.stringify({
            transactionId: updatedTx.id,
            provider: updatedTx.provider,
            amount: Number(updatedTx.amount) / 100,
            currency: updatedTx.currency,
          }),
        },
      });
    }

    this.analytics.track({
      name: 'payment_success',
      userId: order.customerId,
      props: {
        orderId: order.id,
        provider: updatedTx.provider,
        amount: Number(updatedTx.amount) / 100,
        currency: updatedTx.currency,
      },
    });

    await this.notify.createDomainEvent(
      order.customerId,
      'payment.captured',
      `Payment captured for order #${order.id}`,
      {
        orderId: order.id,
        transactionId: updatedTx.id,
        amount: Number(updatedTx.amount) / 100,
        currency: updatedTx.currency,
      },
    );

    if (order.pharmacyId) {
      await this.notify.createDomainEvent(
        order.pharmacyId,
        'payment.captured',
        `Payment captured for order #${order.id}`,
        {
          orderId: order.id,
          transactionId: updatedTx.id,
          amount: Number(updatedTx.amount) / 100,
          currency: updatedTx.currency,
        },
      );
    }

    this.logger.log(`Payment success for order ${tx.orderId}`);
  }

  // --------------------------------------------------------
  // DEV: Capture payment without a provider (fake success)
  // --------------------------------------------------------
  async devCaptureOrder(orderId: number, customerId: number) {
    return this.lock.withLock(`lock:devpay:${orderId}`, 8000, async () => {
      const order: any = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: ({
          id: true,
          customerId: true,
          pharmacyId: true,
          status: true,
          totalPrice: true,
          paymentStatus: true,
        } as any),
      });

      if (!order) throw new BadRequestException('Order not found');
      if (order.customerId !== customerId) throw new BadRequestException('Not your order');

      const ps = String((order as any).paymentStatus || 'UNPAID').toUpperCase();
      if (ps === 'PAID') return { ok: true, already: true };
      if (ps !== 'REQUESTED') {
        throw new BadRequestException('Payment not requested for this order yet');
      }

      // Only allow paying once pharmacy accepted and no further confirmation is pending.
      const st = String(order.status || '').toUpperCase();
      if (st !== String(OrderStatus.ACCEPTED) && st !== String(OrderStatus.ASSIGNED)) {
        throw new BadRequestException(`Cannot pay in status ${order.status}`);
      }

      const amountPaise = Math.round(Number(order.totalPrice) * 100);
      const tx = await this.prisma.transaction.create({
        data: {
          orderId,
          provider: 'dev',
          providerOrder: `dev_${orderId}`,
          providerPayment: `devpay_${Date.now()}`,
          amount: amountPaise,
          currency: 'INR',
          status: 'SUCCESS',
        },
      });

      await this.prisma.order.update({
        where: { id: orderId },
        data: ({ paymentStatus: 'PAID', paidAt: new Date() } as any),
      });

      await this.prisma.orderTimeline.create({
        data: {
          orderId,
          event: 'PAYMENT_CAPTURED',
          data: JSON.stringify({
            transactionId: tx.id,
            provider: tx.provider,
            amount: Number(tx.amount) / 100,
            currency: tx.currency,
            dev: true,
          }),
        },
      });

      await this.notify.createDomainEvent(
        order.customerId,
        'payment.captured',
        `Payment captured for order #${orderId}`,
        {
          orderId,
          transactionId: tx.id,
          amount: Number(tx.amount) / 100,
          currency: tx.currency,
          dev: true,
        },
      );

      if (order.pharmacyId) {
        await this.notify.createDomainEvent(
          order.pharmacyId,
          'payment.captured',
          `Payment captured for order #${orderId}`,
          {
            orderId,
            transactionId: tx.id,
            amount: Number(tx.amount) / 100,
            currency: tx.currency,
            dev: true,
          },
        );
      }

      return { ok: true, transaction: tx };
    });
  }

  private async handlePaymentFailed(payment: any) {
    const providerOrder = payment.order_id;
    if (!providerOrder) return;

    const tx = await this.prisma.transaction.findFirst({
      where: { providerOrder },
    });
    if (!tx) return;

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        providerPayment: payment.id,
        status: 'FAILED',
        rawData: JSON.parse(JSON.stringify(payment)),
      },
    });

    this.analytics.track({
      name: 'payment_fail',
      userId: null,
      props: {
        orderId: tx.orderId ?? null,
        provider: tx.provider,
      },
    });

    this.logger.warn(`Payment FAILED for order ${tx.orderId}`);
  }

  // --------------------------------------------------------
  // REFUND (ADMIN ONLY)
  // --------------------------------------------------------
  async refundTransaction(
    transactionId: string,
    amount?: number,
    adminUserId?: number,
  ) {
    return this.lock.withLock(
      `lock:tx:${transactionId}`,
      8000,
      async () => {
        const tx = await this.prisma.transaction.findUnique({
          where: { id: transactionId },
        });

        if (!tx) throw new BadRequestException('Transaction not found');

        if (tx.status === 'REFUNDED') {
          return { ok: true, refunded: true, already: true };
        }

    const amountPaise = Number(tx.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException('Invalid transaction amount');
    }

    const maxRefundRupees = amountPaise / 100;
    if (amount != null) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException('Invalid refund amount');
      }
      if (n > maxRefundRupees) {
        throw new BadRequestException(
          `Refund amount exceeds charged amount (${maxRefundRupees})`,
        );
      }
    }

    if (tx.status !== 'SUCCESS' && process.env.LOADTEST_MODE !== 'true') {
      throw new BadRequestException(
        `Cannot refund a non-success transaction (status=${tx.status})`,
      );
    }

    // For razorpay refunds we need a captured payment id.
    if (tx.provider === 'razorpay' && !tx.providerPayment) {
      throw new BadRequestException(
        'Cannot refund: missing providerPayment on transaction',
      );
    }

    // LOADTEST MODE
    if (process.env.LOADTEST_MODE === 'true') {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'REFUNDED' },
      });

      if (tx.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: tx.orderId },
          select: { id: true, customerId: true, pharmacyId: true, riderId: true },
        });

        await this.prisma.orderTimeline.create({
          data: {
            orderId: tx.orderId,
            event: 'PAYMENT_REFUNDED',
            data: JSON.stringify({
              transactionId,
              amount: Number(amount ?? maxRefundRupees),
              by: 'ADMIN',
              adminUserId,
              mock: true,
            }),
          },
        });

        if (order?.customerId) {
          await this.notify.createDomainEvent(
            order.customerId,
            'payment.refunded',
            `Refund processed for order #${order.id}`,
            { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) },
          );
        }
        if (order?.pharmacyId) {
          await this.notify.createDomainEvent(
            order.pharmacyId,
            'payment.refunded',
            `Refund processed for order #${order.id}`,
            { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) },
          );
        }

        if (order?.id) {
          await this.riderPayments.handleRefundForOrder(order.id, {
            transactionId,
            amount: Number(amount ?? maxRefundRupees),
            by: 'ADMIN',
          });
        }
      }

      await this.audit.logAdminAction({
        userId: adminUserId,
        action: 'REFUND',
        resource: 'PAYMENT',
        meta: {
          transactionId,
          orderId: tx.orderId,
          amount: Number(tx.amount) / 100,
          mock: true,
        },
      });

      return { mock: true, refunded: true };
    }

    // Non-loadtest: allow mock provider to behave idempotently (no external call).
    if (tx.provider !== 'razorpay') {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'REFUNDED' },
      });

      if (tx.orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: tx.orderId },
          select: { id: true, customerId: true, pharmacyId: true, riderId: true },
        });

        await this.prisma.orderTimeline.create({
          data: {
            orderId: tx.orderId,
            event: 'PAYMENT_REFUNDED',
            data: JSON.stringify({
              transactionId,
              amount: Number(amount ?? maxRefundRupees),
              by: 'ADMIN',
              adminUserId,
              provider: tx.provider,
              localOnly: true,
            }),
          },
        });

        if (order?.customerId) {
          await this.notify.createDomainEvent(
            order.customerId,
            'payment.refunded',
            `Refund processed for order #${order.id}`,
            { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) },
          );
        }
        if (order?.pharmacyId) {
          await this.notify.createDomainEvent(
            order.pharmacyId,
            'payment.refunded',
            `Refund processed for order #${order.id}`,
            { orderId: order.id, transactionId, amount: Number(amount ?? maxRefundRupees) },
          );
        }

        if (order?.id) {
          await this.riderPayments.handleRefundForOrder(order.id, {
            transactionId,
            amount: Number(amount ?? maxRefundRupees),
            by: 'ADMIN',
          });
        }
      }

      await this.audit.logAdminAction({
        userId: adminUserId,
        action: 'REFUND',
        resource: 'PAYMENT',
        meta: {
          transactionId,
          orderId: tx.orderId,
          amount: Number(amount ?? maxRefundRupees),
          provider: tx.provider,
          localOnly: true,
        },
      });

      return { ok: true, refunded: true, provider: tx.provider };
    }

    const refundAmountPaise = amount ? Math.round(amount * 100) : undefined;

    const refund = await this.razorpay.refundPayment(
      tx.providerPayment!,
      refundAmountPaise,
    );

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'REFUNDED',
        rawData: JSON.parse(JSON.stringify(refund)),
      },
    });

    if (tx.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: tx.orderId },
        select: { id: true, customerId: true, pharmacyId: true },
      });

      await this.prisma.orderTimeline.create({
        data: {
          orderId: tx.orderId,
          event: 'PAYMENT_REFUNDED',
          data: JSON.stringify({
            transactionId,
            amount: Number(refundAmountPaise ?? amountPaise) / 100,
            by: 'ADMIN',
            adminUserId,
          }),
        },
      });

      if (order?.customerId) {
        this.notify.create(
          order.customerId,
          'PAYMENT_REFUNDED',
          `Refund processed for order #${order.id}`,
          { orderId: order.id, transactionId },
          adminUserId,
        );
        await this.notify.createDomainEvent(
          order.customerId,
          'payment.refunded',
          `Refund processed for order #${order.id}`,
          {
            orderId: order.id,
            transactionId,
            amount: Number(refundAmountPaise ?? amountPaise) / 100,
          },
        );
      }
      if (order?.pharmacyId) {
        this.notify.create(
          order.pharmacyId,
          'PAYMENT_REFUNDED',
          `Refund processed for order #${order.id}`,
          { orderId: order.id, transactionId },
          adminUserId,
        );
        await this.notify.createDomainEvent(
          order.pharmacyId,
          'payment.refunded',
          `Refund processed for order #${order.id}`,
          {
            orderId: order.id,
            transactionId,
            amount: Number(refundAmountPaise ?? amountPaise) / 100,
          },
        );
      }

      if (order?.id) {
        await this.riderPayments.handleRefundForOrder(order.id, {
          transactionId,
          amount: Number(refundAmountPaise ?? amountPaise) / 100,
          by: 'ADMIN',
        });
      }
    }

    await this.audit.logAdminAction({
      userId: adminUserId,
      action: 'REFUND',
      resource: 'PAYMENT',
      meta: {
        transactionId,
        orderId: tx.orderId,
        amount: Number(refundAmountPaise ?? tx.amount) / 100,
      },
    });

        this.logger.log(`Refund completed for transaction ${transactionId}`);
        return refund;
      },
      { waitMs: 50, retries: 40 },
    );
  }

  async listTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async reconcileOrderPayment(orderId: number, adminUserId?: number) {
    if (!Number.isFinite(orderId)) {
      throw new BadRequestException('Invalid order id');
    }

    const order: any = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: ({
        id: true,
        customerId: true,
        pharmacyId: true,
        paymentStatus: true,
        totalPrice: true,
      } as any),
    });
    if (!order) throw new BadRequestException('Order not found');

    const txs = await this.prisma.transaction.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (!txs.length) return { ok: false, reason: 'no_transactions' };

    const successTx = txs.find(
      (t) => String(t.status || '').toUpperCase() === 'SUCCESS',
    );
    const refundedTx = txs.find(
      (t) => String(t.status || '').toUpperCase() === 'REFUNDED',
    );

    const updates: any = { updated: false, addedTimeline: false };
    const paymentStatus = String(order.paymentStatus || '').toUpperCase();

    if (successTx && paymentStatus !== 'PAID') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: ({ paymentStatus: 'PAID', paidAt: new Date() } as any),
      });

      const existing = await this.prisma.orderTimeline.findFirst({
        where: { orderId, event: 'PAYMENT_CAPTURED' },
      });

      if (!existing) {
        await this.prisma.orderTimeline.create({
          data: {
            orderId,
            event: 'PAYMENT_CAPTURED',
            data: JSON.stringify({
              transactionId: successTx.id,
              provider: successTx.provider,
              amount: Number(successTx.amount) / 100,
              currency: successTx.currency,
              reconciled: true,
            }),
          },
        });
        updates.addedTimeline = true;
      }

      await this.notify.createDomainEvent(
        order.customerId,
        'payment.captured',
        `Payment captured for order #${orderId}`,
        {
          orderId,
          transactionId: successTx.id,
          amount: Number(successTx.amount) / 100,
          currency: successTx.currency,
          reconciled: true,
        },
      );

      if (order.pharmacyId) {
        await this.notify.createDomainEvent(
          order.pharmacyId,
          'payment.captured',
          `Payment captured for order #${orderId}`,
          {
            orderId,
            transactionId: successTx.id,
            amount: Number(successTx.amount) / 100,
            currency: successTx.currency,
            reconciled: true,
          },
        );
      }

      updates.updated = true;
    }

    if (refundedTx) {
      const existingRefund = await this.prisma.orderTimeline.findFirst({
        where: { orderId, event: 'PAYMENT_REFUNDED' },
      });
      if (!existingRefund) {
        await this.prisma.orderTimeline.create({
          data: {
            orderId,
            event: 'PAYMENT_REFUNDED',
            data: JSON.stringify({
              transactionId: refundedTx.id,
              amount: Number(refundedTx.amount) / 100,
              currency: refundedTx.currency,
              reconciled: true,
            }),
          },
        });
        updates.addedTimeline = true;
      }
    }

    if (updates.updated || updates.addedTimeline) {
      await this.audit.logAdminAction({
        userId: adminUserId,
        action: 'PAYMENT_RECONCILE',
        resource: `order:${orderId}`,
        meta: {
          successTxId: successTx?.id,
          refundedTxId: refundedTx?.id,
        },
      });
    }

    return {
      ok: true,
      updated: updates.updated,
      addedTimeline: updates.addedTimeline,
      successTxId: successTx?.id ?? null,
      refundedTxId: refundedTx?.id ?? null,
    };
  }
}
