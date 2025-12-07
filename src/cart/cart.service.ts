// backend/src/cart/cart.service.ts
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

  // ------------------------------
  // ADD ITEM TO CART
  // ------------------------------
  async addToCart(userId: number, medicineId: number, quantity: number) {
    if (!medicineId || quantity < 1) {
      throw new BadRequestException('Invalid cart item.');
    }

    // Find or create cart (userId stored as string)
    let cart = await this.prisma.cart.findFirst({
      where: { userId: String(userId) },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId: String(userId) },
      });
    }

    const productId = String(medicineId);

    // Check if item already exists
    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    // Create new cart item (price 0 until pharmacy selection)
    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        price: 0,
      },
    });
  }

  // ------------------------------
  // GET USER CART (ENRICHED)
  // ------------------------------
  async getCart(userId: number) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId: String(userId) },
      include: { items: true },
    });

    if (!cart) return { items: [] };

    const enriched = await Promise.all(
      cart.items.map(async (item) => {
        const med = await this.prisma.medicine.findUnique({
          where: { id: Number(item.productId) },
        });

        const inv = await this.prisma.pharmacyInventory.findFirst({
          where: { medicineId: med?.id },
          include: { pharmacy: { select: { id: true, name: true } } },
          orderBy: { sellingPrice: 'asc' },
        });

        return {
          ...item,
          medicine: med ?? null,
          price: item.price ? Number(item.price) : inv ? Number(inv.sellingPrice) : 0,
          stock: inv?.stock ?? 0,
          pharmacy: inv?.pharmacy?.name ?? null,
          pharmacyId: inv?.pharmacy?.id ?? null,
        };
      })
    );

    return { ...cart, items: enriched };
  }

  // ------------------------------
  // REMOVE ITEM (FIXED STRING ID)
  // ------------------------------
  async removeItem(userId: number, cartItemId: number) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId: String(userId) },
    });

    if (!cart) throw new BadRequestException('Cart not found');

    const item = await this.prisma.cartItem.findUnique({
      where: { id: String(cartItemId) }, // FIX
    });

    if (!item || item.cartId !== cart.id) {
      throw new BadRequestException('Invalid cart item');
    }

    return this.prisma.cartItem.delete({
      where: { id: String(cartItemId) }, // FIX
    });
  }

  // ------------------------------
  // UPDATE QUANTITY (FIXED STRING ID)
  // ------------------------------
  async updateQuantity(userId: number, cartItemId: number, quantity: number) {
    if (quantity < 1)
      throw new BadRequestException('Quantity must be at least 1');

    const cart = await this.prisma.cart.findFirst({
      where: { userId: String(userId) },
    });

    if (!cart) throw new BadRequestException('Cart not found');

    const item = await this.prisma.cartItem.findUnique({
      where: { id: String(cartItemId) }, // FIX
    });

    if (!item || item.cartId !== cart.id) {
      throw new BadRequestException('Invalid cart item');
    }

    return this.prisma.cartItem.update({
      where: { id: String(cartItemId) }, // FIX
      data: { quantity },
    });
  }

  // ------------------------------
  // CALCULATE TOTAL
  // ------------------------------
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

  // ------------------------------
  // CHECKOUT
  // ------------------------------
  async checkout(
    userId: number,
    dtoItems: any[],
    opts?: { pharmacyId?: number; pickupLat?: number; pickupLon?: number },
  ) {
    if (!dtoItems?.length) throw new BadRequestException('No items provided.');

    const createDto = {
      items: dtoItems,
      pharmacyId: opts?.pharmacyId,
      pickupLat: opts?.pickupLat,
      pickupLon: opts?.pickupLon,
    };

    const result = await this.orders.createOrder(userId, createDto as any);
    const order = (result as any).order ?? result;

    const paymentIntent = await this.payments.createPaymentForOrder(order.id);

    return {
      orderId: order.id,
      order,
      paymentIntent,
      message: 'Order created. Complete payment to proceed.',
    };
  }
}
