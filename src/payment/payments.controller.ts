// src/payment/payments.controller.ts
import { Controller, Post, Body, Headers, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Post('create-intent')
  async createIntent(@Body('amount') amount: number, @Body('userId') userId: number) {
    return this.paymentsService.createPaymentIntent(amount, userId);
  }
}
