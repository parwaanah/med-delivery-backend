// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request as ExpressRequest } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LoginDto {
  email: string;
  password: string;
}

interface SignupDto {
  name: string;
  email: string;
  password: string;
  role?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ✅ Login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() { email, password }: LoginDto) {
    const result = await this.authService.login(email, password);
    return {
      status: 'success',
      message: 'Login successful',
      data: result,
    };
  }

  // ✅ Signup
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() { name, email, password, role }: SignupDto) {
    const result = await this.authService.signup(name, email, password, role);
    return {
      status: 'success',
      message: 'Signup successful',
      data: result,
    };
  }

  // ✅ Get Profile
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: ExpressRequest) {
    const userId = (req.user as any)?.sub;
    if (!userId) throw new NotFoundException('Invalid or missing token');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return {
      status: 'success',
      message: 'User fetched successfully',
      data: user,
    };
  }

  // ✅ Save FCM Device Token
  @Post('save-token')
  @UseGuards(JwtAuthGuard)
  async saveDeviceToken(@Request() req, @Body() body: { token: string }) {
    const userId = req.user.sub;
    const { token } = body;

    if (!token) throw new BadRequestException('FCM token is required');

    await prisma.deviceToken.upsert({
      where: { userId },
      update: { token },
      create: { userId, token },
    });

    return {
      status: 'success',
      message: 'Device token saved successfully',
    };
  }

  // ✅ Refresh access token
  @Post('refresh')
  async refresh(@Body() body: { userId: number; refreshToken: string }) {
    const { userId, refreshToken } = body;
    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    return {
      status: 'success',
      message: 'Tokens refreshed successfully',
      data: tokens,
    };
  }

  // ✅ Logout
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    const userId = req.user.sub;
    await this.authService.logout(userId);
    return {
      status: 'success',
      message: 'Logout successful',
    };
  }
}
