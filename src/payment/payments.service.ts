// src/payment/payments.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../utils/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../utils/notification.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notify: NotificationService,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY') || '');
    this.webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET') || '';
  }

  async createPaymentIntent(amount: number, userId: number) {
    if (!amount || amount < 1)
      throw new BadRequestException('Invalid payment amount.');

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: { userId: String(userId) },
    });

    await this.notify.sendAdminToast({
      type: 'info',
      title: 'Payment Created',
      text: `Payment intent ${paymentIntent.id} for user ${userId}`,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('⚠️ Invalid webhook signature.');
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.notify.sendAdminToast({
          type: 'ok',
          title: 'Payment Success',
          text: `Payment ${intent.id} succeeded for user ${intent.metadata.userId}`,
        });

        await this.prisma.order.updateMany({
          where: { customerId: Number(intent.metadata.userId), status: 'PENDING' },
          data: { status: 'ACCEPTED' }, // ✅ fixed
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const failed = event.data.object as Stripe.PaymentIntent;
        await this.notify.sendAdminToast({
          type: 'err',
          title: 'Payment Failed',
          text: `Payment ${failed.id} failed`,
        });
        break;
      }

      default:
        break;
    }

    return { received: true };
  }
}
