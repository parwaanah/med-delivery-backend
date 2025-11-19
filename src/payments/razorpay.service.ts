// src/payments/razorpay.service.ts
import Razorpay from 'razorpay';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  public readonly client: Razorpay;

  constructor() {
    this.client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });
  }

  async createOrder(amountInPaise: number, currency = 'INR', receipt?: string) {
    const opts = {
      amount: amountInPaise,
      currency,
      receipt: receipt ?? `receipt_${Date.now()}`,
      payment_capture: 1, // auto-capture
    };
    const order = await this.client.orders.create(opts as any);
    this.logger.log(`Razorpay order created ${order.id}`);
    return order as any;
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, secret?: string) {
    const webhookSecret = secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn('Razorpay webhook secret not set');
      return false;
    }
    // Razorpay signature uses HMAC SHA256 of raw body
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return expected === signature;
  }

  async refundPayment(paymentId: string, amountInPaise?: number) {
    const payload: any = amountInPaise ? { amount: amountInPaise } : {};
    return this.client.payments.refund(paymentId, payload);
  }
}
