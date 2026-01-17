import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { RazorpayService } from './razorpay.service';
import { OrderStatus } from '@prisma/client';
import { AuditService } from '../utils/audit.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
    private audit: AuditService,
  ) {}

  // --------------------------------------------------------
  // Create Payment Order
  // --------------------------------------------------------
  async createPaymentForOrder(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new BadRequestException('Order not found');

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

      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });

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

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        providerPayment: payment.id,
        status: 'SUCCESS',
        method: payment.method,
        rawData: JSON.parse(JSON.stringify(payment)),
      },
    });

    if (tx.orderId) {
      await this.prisma.order.update({
        where: { id: tx.orderId },
        data: { status: OrderStatus.PAID },
      });
    }

    this.logger.log(`Payment success for order ${tx.orderId}`);
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
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) throw new BadRequestException('Transaction not found');
    if (tx.status === 'REFUNDED')
      throw new BadRequestException('Transaction already refunded');

    // LOADTEST MODE
    if (process.env.LOADTEST_MODE === 'true') {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'REFUNDED' },
      });

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

    const refundAmountPaise = amount
      ? Math.round(amount * 100)
      : undefined;

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
  }

  async listTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
