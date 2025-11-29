import { Body, Controller, Post, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.auth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body('sessionId') sessionId: number) {
    return this.auth.logout(sessionId);
  }

  @Post('request-password-reset')
  reset(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Email required');
    return this.auth.requestPasswordReset(email);
  }
}
