// src/cart/cart.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  // --------------------------------------------------
  // ADD TO CART
  // --------------------------------------------------
  async addToCart(userId: string, medicineId: number, quantity: number) {
    if (!medicineId || quantity < 1) {
      throw new BadRequestException('Invalid cart item');
    }

    const inventory = await this.prisma.pharmacyInventory.findFirst({
      where: { medicineId, stock: { gt: 0 } },
      orderBy: { sellingPrice: 'asc' },
    });

    if (!inventory) {
      throw new BadRequestException('Medicine out of stock');
    }

    const productId = String(medicineId);

    let cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    // Enforce single-pharmacy cart
    if (cart.items.length > 0) {
      const firstMedicineId = Number(cart.items[0].productId);

      const existingInventory = await this.prisma.pharmacyInventory.findFirst({
        where: { medicineId: firstMedicineId },
      });

      if (
        existingInventory &&
        existingInventory.pharmacyId !== inventory.pharmacyId
      ) {
        throw new BadRequestException(
          'Cart can contain medicines from only one pharmacy',
        );
      }
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    return this.prisma.cartItem.create({
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
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      return { items: [] };
    }

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const medicineId = Number(item.productId);

        const medicine = await this.prisma.medicine.findUnique({
          where: { id: medicineId },
        });

        const inventory = await this.prisma.pharmacyInventory.findFirst({
          where: { medicineId },
          include: { pharmacy: { select: { id: true, name: true } } },
        });

        return {
          id: item.id,
          quantity: item.quantity,
          price: Number(item.price),
          medicine,
          stock: inventory?.stock ?? 0,
          pharmacy: inventory?.pharmacy?.name ?? null,
          pharmacyId: inventory?.pharmacy?.id ?? null,
        };
      }),
    );

    return { id: cart.id, items };
  }

  // --------------------------------------------------
  // REMOVE ITEM
  // --------------------------------------------------
  async removeItem(userId: string, cartItemId: string) {
    const cart = await this.prisma.cart.findFirst({ where: { userId } });
    if (!cart) throw new BadRequestException('Cart not found');

    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new BadRequestException('Invalid cart item');
    }

    return this.prisma.cartItem.delete({ where: { id: cartItemId } });
  }

  // --------------------------------------------------
  // UPDATE QUANTITY
  // --------------------------------------------------
  async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    if (quantity < 1) {
      return this.removeItem(userId, cartItemId);
    }

    const cart = await this.prisma.cart.findFirst({ where: { userId } });
    if (!cart) throw new BadRequestException('Cart not found');

    const item = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!item || item.cartId !== cart.id) {
      throw new BadRequestException('Invalid cart item');
    }

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  // --------------------------------------------------
  // CHECKOUT (PAY AFTER ACCEPT — FINAL)
  // --------------------------------------------------
  async checkout(userId: string, body: { notes?: string }) {
    const cart = await this.prisma.cart.findFirst({
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

    const items = await Promise.all(
      cart.items.map(async (item) => {
        const medicineId = Number(item.productId);

        const medicine = await this.prisma.medicine.findUnique({
          where: { id: medicineId },
        });

        if (!medicine) {
          throw new BadRequestException('Invalid medicine in cart');
        }

        return {
          medicineId,
          name: medicine.name,
          quantity: item.quantity,
          price: Number(item.price),
          category: medicine.category,
        };
      }),
    );

    // Minimal DTO — OrdersService decides payment mode
    const dto = {
      items,
      address: 'Cart checkout',
      notes: body?.notes,
    };

    const order = await this.orders.createOrder(customerId, dto as any);

    // Clear cart ONLY after successful order creation
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return order;
  }
}
