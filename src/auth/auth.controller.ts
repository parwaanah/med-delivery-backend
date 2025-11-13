import { Body, Controller, Post, Req, Logger, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip = req.ip || req.connection?.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.login(dto, ip, ua);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body('sessionId') sessionId: number) {
    return this.authService.logout(sessionId);
  }

  // ✅ Added route for Recovery tab
  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: { email?: string }) {
    const email = body.email?.trim();
    if (!email) throw new BadRequestException('Email is required');
    return this.authService.requestPasswordReset(email);
  }
}
