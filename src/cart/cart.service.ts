// src/cart/cart.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { SurgeService } from '../surge/surge.service';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private surge: SurgeService,
    private payments: PaymentsService,
    private orders: OrdersService,
  ) {}

  /**
   * Calculate final price including surge
   */
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
   * - Create order (offers will be created by OrdersService when pharmacy not specified)
   * - Create Razorpay order (payment intent)
   */
  async checkout(userId: number, dtoItems: any[], opts?: { pharmacyId?: number, pickupLat?: number, pickupLon?: number }) {
    if (!dtoItems?.length) throw new BadRequestException('No items provided.');

    // 1) Create order using OrdersService so it runs candidate selection / orderOffers
    const createDto = {
      items: dtoItems,
      pharmacyId: opts?.pharmacyId,
      pickupLat: opts?.pickupLat,
      pickupLon: opts?.pickupLon,
    };

    // OrdersService.createOrder expects typed DTO; we pass through as any
    const result = await this.orders.createOrder(userId, createDto as any);
    // result may be { order } or (order, candidates, scores)
    const order = result.order ?? result;

    // 2) Create Razorpay order for payment
    const paymentIntent = await this.payments.createPaymentForOrder(order.id);

    return {
      orderId: order.id,
      order,
      paymentIntent,
      message: 'Order created. Complete payment to proceed.',
    };
  }
}
