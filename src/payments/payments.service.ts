// src/payments/payments.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private rzp: RazorpayService,
  ) {}

  /**
   * Create Razorpay order + transaction record
   * (Swiggy-style flow: order exists earlier; we call this to create provider order)
   */
  async createPaymentForOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new BadRequestException('Order not found');

    if (order.status === OrderStatus.PAID) {
      throw new BadRequestException('Order is already paid');
    }

    const amount = Number(order.totalPrice ?? 0);
    if (amount <= 0) throw new BadRequestException('Invalid order amount');

    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const rzpOrder = await this.rzp.createOrder(
      amountInPaise,
      'INR',
      `order_${orderId}`,
    );

    // Local DB transaction
    const tx = await this.prisma.transaction.create({
      data: {
        orderId: order.id,
        provider: 'razorpay',
        providerOrder: rzpOrder.id,
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
   * - verify caller ensures signature already validated in controller
   * - saves attempt audit
   * - updates transaction(s)
   * - if payment captured/paid -> mark order PAID
   */
  async handleWebhookEvent(payload: any) {
    const event = payload.event ?? 'unknown';

    const paymentEntity =
      payload?.payload?.payment?.entity ??
      payload?.payload?.payment_entity?.entity ??
      null;

    const rzpOrderId =
      paymentEntity?.order_id ??
      payload?.payload?.order?.entity?.id ??
      null;

    // Save audit copy
    await this.prisma.paymentAttempt.create({
      data: {
        providerOrder: rzpOrderId ?? 'unknown',
        attemptData: payload as any,
      },
    });

    // Update transaction(s)
    await this.prisma.transaction.updateMany({
      where: { providerOrder: rzpOrderId },
      data: {
        providerPayment: paymentEntity?.id ?? null,
        status: paymentEntity?.status ?? event,
        method: paymentEntity?.method ?? undefined,
        rawData: payload as any,
      },
    });

    // Load local transaction
    const tx = await this.prisma.transaction.findFirst({
      where: { providerOrder: rzpOrderId },
    });

    if (!tx) {
      this.logger.warn(`Webhook for unknown transaction: ${rzpOrderId}`);
      return { ok: true };
    }

    const successStatuses = ['captured', 'authorized', 'paid'];
    const statusFromProvider = (paymentEntity?.status ?? event) as string;

    if (successStatuses.includes(statusFromProvider)) {
      const orderIdNum = Number(tx.orderId);
      if (!isNaN(orderIdNum)) {
        await this.prisma.order.update({
          where: { id: orderIdNum },
          data: { status: OrderStatus.PAID },
        });
      } else {
        this.logger.warn(`Invalid orderId on tx: ${tx.id} orderId=${tx.orderId}`);
      }
    }

    this.logger.log(`Webhook processed: ${event}`);
    return { ok: true };
  }

  async refundTransaction(txId: string, amount?: number) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: txId },
    });

    if (!tx) throw new BadRequestException('Transaction not found');
    if (!tx.providerPayment)
      throw new BadRequestException('Cannot refund — payment ID missing');

    const amountInPaise = amount ? Math.round(amount * 100) : undefined;

    const refund = await this.rzp.refundPayment(
      tx.providerPayment,
      amountInPaise,
    );

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
    return await this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
