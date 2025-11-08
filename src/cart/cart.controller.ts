// src/cart/cart.controller.ts
import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
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
