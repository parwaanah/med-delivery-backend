// src/payments/payments.controller.ts
import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { PrismaService } from '../utils/prisma.service';
import { Request, Response } from 'express';
import { CreateIntentDto } from './dto/create-intent.dto';
import { RefundDto } from './dto/refund.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private rzpService: RazorpayService,
    private prisma: PrismaService,
  ) {}

  @Post('create-intent')
  async createIntent(@Body() body: CreateIntentDto) {
    const orderId = Number(body.orderId);
    if (isNaN(orderId)) throw new BadRequestException('Invalid orderId');
    return this.paymentsService.createPaymentForOrder(orderId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    try {
      const raw = (req as any).rawBody as Buffer;
      if (!raw) return res.status(400).send('raw body missing');

      const valid = this.rzpService.verifyWebhookSignature(raw, signature);
      if (!valid) return res.status(400).send('invalid signature');

      const json = JSON.parse(raw.toString('utf8'));
      await this.paymentsService.handleWebhookEvent(json);
      return res.status(200).send('ok');
    } catch (err) {
      console.error('payments webhook error', err);
      return res.status(500).send('error');
    }
  }

  @Post('refund')
  async refund(@Body() dto: RefundDto) {
    return this.paymentsService.refundTransaction(dto.transactionId, dto.amount);
  }

  @Get('admin/list')
  async adminList() {
    return this.paymentsService.listTransactions();
  }

  @Get('by-order/:orderId')
  async byOrder(@Param('orderId') orderId: string) {
    const idNum = Number(orderId);
    if (isNaN(idNum)) return [];
    return this.prisma.transaction.findMany({
      where: { orderId: idNum },
      orderBy: { createdAt: 'desc' },
    });
  }
}
