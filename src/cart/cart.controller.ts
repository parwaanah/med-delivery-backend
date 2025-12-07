// backend/src/cart/cart.controller.ts
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
  async addToCart(
    @Req() req: Request,
    @Body() body: { medicineId: number; quantity?: number },
  ) {
    const userId = (req as any).user.id;
    return this.cartService.addToCart(
      userId,
      body.medicineId,
      body.quantity ?? 1,
    );
  }

  @Get()
  async getCart(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.cartService.getCart(userId);
  }

  @Post('remove')
  async removeItem(@Req() req: Request, @Body() body: { cartItemId: number }) {
    const userId = (req as any).user.id;
    return this.cartService.removeItem(userId, body.cartItemId);
  }

  @Post('update')
  async updateQuantity(
    @Req() req: Request,
    @Body() body: { cartItemId: number; quantity: number },
  ) {
    const userId = (req as any).user.id;
    return this.cartService.updateQuantity(
      userId,
      body.cartItemId,
      body.quantity,
    );
  }

  @Post('total')
  async calculateTotal(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user.id;
    return this.cartService.calculateTotal(userId, body.items);
  }

  @Post('checkout')
  async checkout(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user.id;
    return this.cartService.checkout(userId, body.items);
  }
}
