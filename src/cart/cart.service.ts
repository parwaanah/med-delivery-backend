// src/cart/cart.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { Prisma } from '@prisma/client';
import { badRequest } from '../common/api-error';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  private maxQtyPerItem() {
    const raw = Number(process.env.CART_MAX_QTY_PER_ITEM ?? 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 10;
  }

  private async clearCoupon(cartId: string) {
    await (this.prisma as any).cart.update({
      where: { id: cartId },
      data: { couponCode: null, couponDiscount: null, couponAppliedAt: null },
    });
  }

  private async resolveCartPharmacyId(cart: {
    items: Array<{ productId: string; price: any; quantity?: number }>;
  }) {
    const first = cart.items?.[0];
    if (!first) return null;

    const medicineId = Number(first.productId);
    if (!Number.isFinite(medicineId)) return null;

    // Prefer a pharmacy that matches the stored cart price (stable across sessions).
    const invByPrice = await this.prisma.pharmacyInventory.findFirst({
      where: ({ medicineId, sellingPrice: first.price, deletedAt: null, stock: { gt: 0 } } as any),
      select: { pharmacyId: true },
    });
    if (invByPrice?.pharmacyId) return Number(invByPrice.pharmacyId);

    // Fallback to current cheapest in-stock pharmacy for the first item.
    const invCheapest = await this.prisma.pharmacyInventory.findFirst({
      where: ({ medicineId, deletedAt: null, stock: { gt: 0 } } as any),
      orderBy: { sellingPrice: 'asc' },
      select: { pharmacyId: true },
    });
    if (invCheapest?.pharmacyId) return Number(invCheapest.pharmacyId);

    return null;
  }

  private async validateCouponForSubtotal(userId: number, code: string, subtotal: number) {
    const now = new Date();
    const coupon = await (this.prisma as any).coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.active) badRequest('COUPON_INVALID', 'Invalid coupon');
    if (coupon.startsAt && coupon.startsAt > now) {
      badRequest('COUPON_NOT_STARTED', 'Coupon not started', { startsAt: coupon.startsAt });
    }
    if (coupon.endsAt && coupon.endsAt < now) {
      badRequest('COUPON_EXPIRED', 'Coupon expired', { endsAt: coupon.endsAt });
    }

    const min = coupon.minOrder != null ? Number(coupon.minOrder) : null;
    if (min != null && subtotal < min) {
      badRequest('COUPON_MIN_ORDER', 'Cart total too low for this coupon', { minOrder: min, subtotal });
    }

    const [totalUsed, userUsed] = await Promise.all([
      coupon.usageLimit != null
        ? (this.prisma as any).couponRedemption.count({
            where: { couponId: coupon.id, orderId: { not: null } },
          })
        : Promise.resolve(0),
      coupon.perUserLimit != null
        ? (this.prisma as any).couponRedemption.count({
            where: { couponId: coupon.id, userId, orderId: { not: null } },
          })
        : Promise.resolve(0),
    ]);

    if (coupon.usageLimit != null && totalUsed >= coupon.usageLimit) {
      badRequest('COUPON_USAGE_LIMIT', 'Coupon usage limit reached', {
        usageLimit: coupon.usageLimit,
        totalUsed,
      });
    }
    if (coupon.perUserLimit != null && userUsed >= coupon.perUserLimit) {
      badRequest('COUPON_PER_USER_LIMIT', 'Coupon already used', {
        perUserLimit: coupon.perUserLimit,
        userUsed,
      });
    }

    let discount = 0;
    if (String(coupon.type).toUpperCase() === 'FLAT') {
      discount = Number(coupon.amount);
    } else {
      const pct = Math.max(0, Math.min(100, Number(coupon.amount)));
      discount = (subtotal * pct) / 100;
    }

    const max = coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null;
    if (max != null) discount = Math.min(discount, max);

    discount = Math.max(0, Math.min(discount, subtotal));
    return { coupon, discount };
  }

  // --------------------------------------------------
  // ADD TO CART
  // --------------------------------------------------
  async addToCart(userId: string, medicineId: number, quantity: number) {
    if (!medicineId || quantity < 1) {
      throw new BadRequestException('Invalid cart item');
    }

    const inventory = await this.prisma.pharmacyInventory.findFirst({
      where: ({ medicineId, stock: { gt: 0 }, deletedAt: null } as any),
      orderBy: { sellingPrice: 'asc' },
    });

    if (!inventory) {
      badRequest('STOCK_OUT', 'Medicine out of stock', { medicineId });
    }

    const productId = String(medicineId);

    let cart = await (this.prisma as any).cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await (this.prisma as any).cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    // Enforce single-pharmacy cart
    if (cart.items.length > 0) {
      const cartPharmacyId = await this.resolveCartPharmacyId(cart as any);

      if (cartPharmacyId != null && cartPharmacyId !== inventory.pharmacyId) {
        throw new BadRequestException(
          'Cart can contain medicines from only one pharmacy',
        );
      }
    }

    const existing = await (this.prisma as any).cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (existing) {
      const maxQty = this.maxQtyPerItem();
      const nextQty = existing.quantity + quantity;
      if (nextQty > maxQty) {
        badRequest('CART_MAX_QTY', `Max quantity per item is ${maxQty}`, { maxQty });
      }
      if ((inventory.stock ?? 0) < nextQty) {
        badRequest('STOCK_INSUFFICIENT', 'Insufficient stock', {
          available: inventory.stock ?? 0,
          requested: nextQty,
        });
      }

      if (cart.couponCode) await this.clearCoupon(cart.id);
      return (this.prisma as any).cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      });
    }

    const maxQty = this.maxQtyPerItem();
    if (quantity > maxQty) {
      badRequest('CART_MAX_QTY', `Max quantity per item is ${maxQty}`, { maxQty });
    }
    if ((inventory.stock ?? 0) < quantity) {
      badRequest('STOCK_INSUFFICIENT', 'Insufficient stock', {
        available: inventory.stock ?? 0,
        requested: quantity,
      });
    }

    if (cart.couponCode) await this.clearCoupon(cart.id);
    return (this.prisma as any).cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        price: inventory.sellingPrice,
      },
    });
  }

  // --------------------------------------------------
  // GET CART
  // --------------------------------------------------
  async getCart(userId: string) {
    const cart = await (this.prisma as any).cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      return { items: [] };
    }

    const cartPharmacyId = await this.resolveCartPharmacyId(cart as any);

    const items = await Promise.all(
      cart.items.map(async (item: any) => {
        const medicineId = Number(item.productId);

        const medicine = await this.prisma.medicine.findUnique({
          where: { id: medicineId },
        });

        const inventory = cartPharmacyId
          ? await (this.prisma as any).pharmacyInventory.findUnique(({
              where: { pharmacyId_medicineId: { pharmacyId: cartPharmacyId, medicineId } },
              include: { pharmacy: { select: { id: true, name: true } } },
            } as any))
          : await (this.prisma as any).pharmacyInventory.findFirst({
              where: ({ medicineId, deletedAt: null } as any),
              orderBy: { sellingPrice: 'asc' },
              include: { pharmacy: { select: { id: true, name: true } } },
            });

        return {
          id: item.id,
          quantity: item.quantity,
          price: Number(item.price),
          medicine,
          stock: (inventory as any)?.stock ?? 0,
          pharmacy: (inventory as any)?.pharmacy?.name ?? null,
          pharmacyId: (inventory as any)?.pharmacy?.id ?? null,
        };
      }),
    );

    return { id: cart.id, items };
  }

  // --------------------------------------------------
  // REMOVE ITEM
  // --------------------------------------------------
  async removeItem(userId: string, cartItemId: string) {
    const cart = await (this.prisma as any).cart.findFirst({ where: { userId } });
    if (!cart) throw new BadRequestException('Cart not found');

    const item = await (this.prisma as any).cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new BadRequestException('Invalid cart item');
    }

    const deleted = await (this.prisma as any).cartItem.delete({ where: { id: cartItemId } });
    if (cart.couponCode) await this.clearCoupon(cart.id);
    return deleted;
  }

  // --------------------------------------------------
  // UPDATE QUANTITY
  // --------------------------------------------------
  async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    if (quantity < 1) {
      return this.removeItem(userId, cartItemId);
    }

    const cart = await (this.prisma as any).cart.findFirst({ where: { userId } });
    if (!cart) throw new BadRequestException('Cart not found');

    const item = await (this.prisma as any).cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new BadRequestException('Invalid cart item');
    }

    const maxQty = this.maxQtyPerItem();
    if (quantity > maxQty) {
      badRequest('CART_MAX_QTY', `Max quantity per item is ${maxQty}`, { maxQty });
    }

    // Validate stock at the cart's pharmacy (single-pharmacy cart constraint)
    const cartWithItems = await (this.prisma as any).cart.findUnique({
      where: { id: cart.id },
      include: { items: true },
    });
    const cartPharmacyId = cartWithItems
      ? await this.resolveCartPharmacyId(cartWithItems as any)
      : null;

    if (cartPharmacyId != null) {
      const inv = await (this.prisma as any).pharmacyInventory.findUnique(({
        where: { pharmacyId_medicineId: { pharmacyId: cartPharmacyId, medicineId: Number(item.productId) } },
        select: { stock: true },
      } as any));
      if (!inv) throw new BadRequestException('Medicine out of stock');
      if ((inv.stock ?? 0) < quantity) {
        badRequest('STOCK_INSUFFICIENT', 'Insufficient stock', {
          available: inv.stock ?? 0,
          requested: quantity,
        });
      }
    }

    if (cart.couponCode) await this.clearCoupon(cart.id);
    return (this.prisma as any).cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  // --------------------------------------------------
  // COUPONS
  // --------------------------------------------------
  async applyCoupon(userId: string, code?: string) {
    const customerId = Number(userId);
    if (Number.isNaN(customerId)) throw new BadRequestException('Invalid customer');

    const c = String(code || '').trim().toUpperCase();
    if (!c) throw new BadRequestException('Coupon code required');

    const cart = await (this.prisma as any).cart.findFirst({
      where: { userId },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');

    const subtotal = cart.items.reduce(
      (sum: number, it: any) => sum + Number(it.price) * it.quantity,
      0,
    );
    const { coupon, discount } = await this.validateCouponForSubtotal(customerId, c, subtotal);

    await (this.prisma as any).cart.update({
      where: { id: cart.id },
      data: {
        couponCode: coupon.code,
        couponDiscount: new Prisma.Decimal(discount),
        couponAppliedAt: new Date(),
      },
    });

    return { ok: true, code: coupon.code, discount };
  }

  async removeCoupon(userId: string) {
    const cart = await (this.prisma as any).cart.findFirst({ where: { userId } });
    if (!cart) return { ok: true };
    await this.clearCoupon(cart.id);
    return { ok: true };
  }

  // --------------------------------------------------
  // CHECKOUT (PAY AFTER ACCEPT — FINAL)
  // --------------------------------------------------
  async checkout(
    userId: string,
    body: {
      notes?: string;
      addressId?: number;
      deliveryNotes?: string;
      paymentMode?: string;
    },
  ) {
    const cart = await (this.prisma as any).cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const customerId = Number(userId);
    if (Number.isNaN(customerId)) {
      throw new BadRequestException('Invalid customer');
    }

    const cartPharmacyId = await this.resolveCartPharmacyId(cart as any);
    if (!cartPharmacyId) {
      throw new BadRequestException('Cart items are out of stock');
    }

    const items = await Promise.all(
      cart.items.map(async (item: any) => {
        const medicineId = Number(item.productId);

        const medicine = await this.prisma.medicine.findUnique({
          where: { id: medicineId },
        });

        if (!medicine) {
          throw new BadRequestException('Invalid medicine in cart');
        }

        const inv = await (this.prisma as any).pharmacyInventory.findUnique(({
          where: { pharmacyId_medicineId: { pharmacyId: cartPharmacyId, medicineId } },
          select: { stock: true, sellingPrice: true },
        } as any));

        if (!inv) throw new BadRequestException('Medicine out of stock');
        if ((inv.stock ?? 0) < item.quantity) throw new BadRequestException('Insufficient stock');

        return {
          medicineId,
          name: medicine.name,
          quantity: item.quantity,
          price: Number(inv.sellingPrice),
          category: medicine.category,
        };
      }),
    );

    // Minimal DTO — OrdersService decides payment mode
    const dto = {
      items,
      addressId: body?.addressId,
      deliveryNotes: body?.deliveryNotes,
      paymentMode: body?.paymentMode,
      couponCode: cart.couponCode || undefined,
      pharmacyId: cartPharmacyId,
      address: 'Cart checkout', // legacy fallback only
      notes: body?.notes,
    };

    const order = await this.orders.createOrder(customerId, dto as any);

    // Clear cart ONLY after successful order creation
    await (this.prisma as any).cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    if (cart.couponCode) await this.clearCoupon(cart.id);

    return order;
  }
}
