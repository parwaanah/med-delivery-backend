import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip = req.ip || '';
    const ua = String(req.headers['user-agent'] || '');
    return this.auth.login(dto, ip, ua);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body('sessionId') sessionId: number) {
    return this.auth.logout(sessionId);
  }

  // OTP
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Req() req: Request, @Body() dto: VerifyOtpDto) {
    const ip = req.ip || '';
    const ua = String(req.headers['user-agent'] || '');
    return this.auth.verifyOtp(dto, ip, ua);
  }

  // GOOGLE LOGIN
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.auth.googleLogin(req.user);

    const encoded = encodeURIComponent(JSON.stringify(result));

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';

    return res.redirect(`${frontend}/auth/google/callback?data=${encoded}`);
  }
}
