import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip =
      req.ip || req.connection?.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.login(dto, ip, ua);
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  async logout(@Body('sessionId') sessionId: number) {
    return this.authService.revokeSession(sessionId);
  }
}
