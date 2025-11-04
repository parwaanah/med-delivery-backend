import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth') // ✅ Groups routes under "Auth" in Swagger
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ------------------ REGISTER ------------------
  @Post('register')
  @ApiBody({
    type: RegisterDto,
    description: 'Register a new user',
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ------------------ LOGIN ------------------
  @Post('login')
  @ApiBody({
    type: LoginDto,
    description: 'Authenticate user and get access + refresh tokens',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const ip = req.ip || req.connection?.remoteAddress || undefined;
    const ua = req.headers['user-agent'] || undefined;
    return this.authService.login(dto, ip, ua);
  }

  // ------------------ REFRESH ------------------
  @Post('refresh')
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Use refresh token to obtain new access token',
  })
  @ApiResponse({ status: 200, description: 'Access token refreshed successfully' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  // ------------------ LOGOUT ------------------
  @Post('logout')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'number', example: 1 },
      },
    },
    description: 'Logout and revoke current session',
  })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body('sessionId') sessionId: number) {
    return this.authService.logout(sessionId);
  }
}
