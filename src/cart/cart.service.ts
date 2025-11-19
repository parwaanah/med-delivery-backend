import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private surge: SurgeService,
    private payments: PaymentsService,
    private orders: OrdersService,
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

  /**
   * Full checkout pipeline (Swiggy-style)
   */
  async checkout(userId: number, dtoItems: any[], opts?: { pharmacyId?: number; pickupLat?: number; pickupLon?: number }) {
    if (!dtoItems?.length) throw new BadRequestException('No items provided.');

    const createDto = {
      items: dtoItems,
      pharmacyId: opts?.pharmacyId,
      pickupLat: opts?.pickupLat,
      pickupLon: opts?.pickupLon,
    };

    // OrdersService.createOrder may return either:
    // - an Order object
    // - or an object { order, candidates, scores }
    const result = await this.orders.createOrder(userId, createDto as any);
    const resultAny = result as any;
    const order = resultAny.order ?? resultAny; // safe cast to any resolves TS union issue

    // create payment intent for the order
    const paymentIntent = await this.payments.createPaymentForOrder(order.id);

    return {
      orderId: order.id,
      order,
      paymentIntent,
      message: 'Order created. Complete payment to proceed.',
    };
  }
}
