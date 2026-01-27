// src/cart/cart.controller.ts
import { Controller, Post, Body, Req, Get, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('add')
  add(
    @Req() req: Request,
    @Body() body: { medicineId: number; quantity?: number },
  ) {
    return this.cartService.addToCart(
      String((req as any).user.id),
      body.medicineId,
      body.quantity ?? 1,
    );
  }

  @Get()
  get(@Req() req: Request) {
    return this.cartService.getCart(String((req as any).user.id));
  }

  @Post('remove')
  remove(@Req() req: Request, @Body() body: { cartItemId: string }) {
    return this.cartService.removeItem(
      String((req as any).user.id),
      body.cartItemId,
    );
  }

  @Post('update')
  update(
    @Req() req: Request,
    @Body() body: { cartItemId: string; quantity: number },
  ) {
    return this.cartService.updateQuantity(
      String((req as any).user.id),
      body.cartItemId,
      body.quantity,
    );
  }

  // ✅ FIXED CHECKOUT
  @Post('checkout')
  checkout(
    @Req() req: Request,
    @Body()
    body: {
      notes?: string;
      addressId?: number;
      deliveryNotes?: string;
      paymentMode?: string;
    },
  ) {
    return this.cartService.checkout(
      String((req as any).user.id),
      body,
    );
  }
}
