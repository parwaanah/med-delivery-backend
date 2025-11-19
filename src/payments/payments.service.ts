import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService, private rzp: RazorpayService) {}

  /**
   * Create Razorpay order + transaction record
   */
  async createPaymentForOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new BadRequestException('Order not found');

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Order is already paid');
    }

    const amount = Number(order.totalPrice ?? 0);
    if (amount <= 0) throw new BadRequestException('Invalid order amount');

    const amountInPaise = Math.round(amount * 100);

    const rzpOrder = await this.rzp.createOrder(amountInPaise, 'INR', `order_${orderId}`);

    // Local DB transaction (Transaction model expects amount as Decimal; Prisma client accepts number)
    const tx = await this.prisma.transaction.create({
      data: {
        orderId: order.id,
        provider: 'razorpay',
        providerOrder: (rzpOrder as any)?.id ?? null,
        providerPayment: null,
        amount: amount,
        currency: 'INR',
        status: 'created',
        rawData: rzpOrder as any,
      },
    });

    return { rzpOrder, transaction: tx };
  }

  /**
   * Handle webhook event from Razorpay
   */
  async handleWebhookEvent(payload: any) {
    const event = payload?.event ?? 'unknown';

    // payment entity fallback detection
    const paymentEntity =
      payload?.payload?.payment?.entity ??
      payload?.payload?.payment_entity?.entity ??
      payload?.payload?.payment_entity ??
      null;

    const rzpOrderId =
      paymentEntity?.order_id ??
      payload?.payload?.order?.entity?.id ??
      payload?.payload?.order_entity?.entity?.id ??
      null;

    // Save audit copy (PaymentAttempt)
    try {
      await this.prisma.paymentAttempt.create({
        data: {
          providerOrder: rzpOrderId ?? null,
          attemptData: payload as any,
        },
      });
    } catch (err) {
      this.logger.warn('Failed saving paymentAttempt audit', (err as any)?.message ?? err);
    }

    // Update transaction(s) for providerOrder
    try {
      await this.prisma.transaction.updateMany({
        where: { providerOrder: rzpOrderId ?? '' },
        data: {
          providerPayment: paymentEntity?.id ?? undefined,
          status: (paymentEntity?.status ?? event) as string,
          method: paymentEntity?.method ?? undefined,
          rawData: payload as any,
        },
      });
    } catch (err) {
      this.logger.warn('Failed updating transaction(s)', (err as any)?.message ?? err);
    }

    // Load one local transaction (if any)
    const tx = await this.prisma.transaction.findFirst({
      where: { providerOrder: rzpOrderId ?? '' },
    });

    if (!tx) {
      this.logger.warn(`Webhook for unknown transaction: ${rzpOrderId}`);
      return { ok: true };
    }

    const successStatuses = ['captured', 'authorized', 'paid'];
    const statusFromProvider = String(paymentEntity?.status ?? event).toLowerCase();

    if (successStatuses.includes(statusFromProvider)) {
      const orderIdNum = Number(tx.orderId);
      if (!isNaN(orderIdNum)) {
        try {
          await this.prisma.order.update({
            where: { id: orderIdNum },
            data: { status: OrderStatus.PAID },
          });
        } catch (err) {
          this.logger.warn('Failed marking order PAID', (err as any)?.message ?? err);
        }
      } else {
        this.logger.warn(`Invalid orderId on tx: ${tx.id} orderId=${tx.orderId}`);
      }
    }

    this.logger.log(`Webhook processed: ${event}`);
    return { ok: true };
  }

  async refundTransaction(txId: string, amount?: number) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx) throw new BadRequestException('Transaction not found');
    if (!tx.providerPayment) throw new BadRequestException('Cannot refund — payment ID missing');

    const amountInPaise = amount ? Math.round(amount * 100) : undefined;
    const refund = await this.rzp.refundPayment(tx.providerPayment, amountInPaise);

    await this.prisma.transaction.create({
      data: {
        orderId: tx.orderId,
        provider: 'razorpay',
        providerOrder: tx.providerOrder,
        providerPayment: tx.providerPayment,
        amount: amount ?? 0,
        currency: 'INR',
        status: 'refund_initiated',
        rawData: refund as any,
      },
    });

    return refund;
  }

  async listTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
