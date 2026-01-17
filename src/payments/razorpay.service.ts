import Razorpay from 'razorpay';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly client?: Razorpay;
  private readonly enabled: boolean;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // ✅ Razorpay enabled ONLY if keys are present
    this.enabled = Boolean(keyId && keySecret);

    if (this.enabled) {
      this.client = new Razorpay({
        key_id: keyId!,
        key_secret: keySecret!,
      });
      this.logger.log('Razorpay client initialized');
    } else {
      this.logger.warn(
        'Razorpay disabled — missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET',
      );
    }
  }

  async createOrder(
    amountInPaise: number,
    currency = 'INR',
    receipt?: string,
  ) {
    // 🛑 HARD STOP — never call Razorpay without keys
    if (!this.enabled || !this.client) {
      this.logger.warn('Razorpay createOrder skipped (disabled)');
      throw new BadRequestException('Payment gateway not configured');
    }

    try {
      const opts = {
        amount: amountInPaise,
        currency,
        receipt: receipt ?? `receipt_${Date.now()}`,
        payment_capture: 1,
      };

      const order = await this.client.orders.create(opts as any);
      this.logger.log(`Razorpay order created ${order?.id}`);
      return order as any;
    } catch (err: any) {
      this.logger.error(
        'Razorpay createOrder failed',
        err?.message || err,
      );
      throw new BadRequestException('Razorpay authentication failed');
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, secret?: string) {
    const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn('Razorpay webhook secret not set');
      return false;
    }

    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return expected === signature;
  }

  async refundPayment(paymentId: string, amountInPaise?: number) {
    if (!this.enabled || !this.client) {
      this.logger.warn('Razorpay refund skipped (disabled)');
      return { mock: true, refunded: true };
    }

    const payload: any = amountInPaise ? { amount: amountInPaise } : {};
    return this.client.payments.refund(paymentId, payload);
  }
}
