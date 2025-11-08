// src/cart/cart.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { PaymentsService } from '../payment/payments.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private surge: SurgeService,
    private payments: PaymentsService,
  ) {}

  async calculateTotal(userId: number, items: any[]) {
    if (!items?.length) throw new BadRequestException('No items provided.');

    const baseTotal = items.reduce((t, i) => t + i.price * i.quantity, 0);
    const { multiplier: surgeMultiplier } = await this.surge.getStatus();

    const total = Number((baseTotal * surgeMultiplier).toFixed(2));

    return {
      baseTotal,
      surgeMultiplier,
      total,
      message: surgeMultiplier > 1 ? 'Surge pricing active' : 'Normal pricing',
    };
  }

  async checkout(userId: number, items: any[]) {
    const total = await this.calculateTotal(userId, items);
    const intent = await this.payments.createPaymentIntent(total.total, userId);

    return {
      ...total,
      paymentIntent: intent,
    };
  }
}
