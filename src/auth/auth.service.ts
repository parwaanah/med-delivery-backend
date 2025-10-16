import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, $Enums } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AuthService implements OnModuleDestroy {
  constructor(private readonly jwtService: JwtService) {}

  // ✅ SIGNUP
  async signup(
    name: string,
    email: string,
    password: string,
    role: string = 'customer',
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const validRoles = Object.values($Enums.Role);
    const normalizedRole = validRoles.includes(role as $Enums.Role)
      ? (role as $Enums.Role)
      : $Enums.Role.customer;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: normalizedRole,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // ✅ Return clean user object (no password)
    return {
      message: 'Signup successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  // ✅ LOGIN
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // ✅ Return clean user + tokens
    return {
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  // ✅ REFRESH TOKENS
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('No session found');

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      message: 'Tokens refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ✅ LOGOUT
  async logout(userId: number) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logout successful' };
  }

  // ✅ GENERATE ACCESS & REFRESH TOKENS
  private async generateTokens(
    userId: number,
    email: string,
    role: $Enums.Role,
  ) {
    const payload = { sub: userId, email, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  // ✅ SAVE HASHED REFRESH TOKEN
  private async saveRefreshToken(userId: number, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed },
    });
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }
}
