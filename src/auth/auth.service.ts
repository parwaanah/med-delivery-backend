// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { addHours, isBefore } from 'date-fns';

import { PrismaService } from '../utils/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuditService } from '../utils/audit.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly LOADTEST = process.env.LOADTEST_MODE === 'true';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
  ) {}

  /**
   * REGISTER
   */
  async register(data: RegisterDto) {
    if (!data.name || !data.email || !data.password)
      throw new BadRequestException('Name, email and password required');

    const exists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (exists) throw new BadRequestException('Email already in use');

    const hashed = await bcrypt.hash(data.password, 10);
    const role = (data.role as UserRole) || UserRole.CUSTOMER;
    const status = role === UserRole.CUSTOMER ? 'APPROVED' : 'PENDING';

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role,
        status,
      },
    });

    await this.audit.log({
  userId: user.id,
  email: user.email || undefined,
  role: user.role,
  eventType: 'REGISTER_SUCCESS',
  success: true,
});

    return this.generateToken(user);
  }

  /**
   * LOGIN — email + password
   */
  async login(data: LoginDto, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (!this.LOADTEST) {
      if (user.status !== 'APPROVED' && user.role !== UserRole.CUSTOMER) {
        throw new UnauthorizedException('Account pending admin approval');
      }
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: ip || null,
        userAgent: ua ? String(ua) : null,
        expiresAt: addHours(new Date(), 12),
      },
    });

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const hashedRefresh = crypto
      .createHash('sha256')
      .update(rawRefresh)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashedRefresh,
        expiresAt: addHours(new Date(), 48),
      },
    });

    await this.audit.log({
  userId: user.id,
  email: user.email || undefined,
  eventType: 'LOGIN_SUCCESS',
  role: user.role,
  success: true,
});

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      sessionId: session.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  /**
   * Refresh token rotation
   */
  async refreshToken(oldToken: string) {
    if (!oldToken) throw new UnauthorizedException('Missing token');

    const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');

    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: oldHash, revoked: false },
      include: { session: true },
    });

    if (!existing || !existing.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.expiresAt && isBefore(existing.expiresAt, new Date())) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    if (existing.session.revoked) {
      throw new UnauthorizedException('Session revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: existing.session.userId },
    });

    if (!user) throw new UnauthorizedException('User not found');

    const newRaw = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: existing.session.id,
        tokenHash: newHash,
        expiresAt: addHours(new Date(), 48),
      },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRaw,
      sessionId: existing.session.id,
    };
  }

  /**
   * Password reset
   */
  async requestPasswordReset(email: string) {
    if (!email) throw new BadRequestException('Email required');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('No such user');

    const token = crypto.randomBytes(20).toString('hex');
    const link = `https://app/reset-password?token=${token}`;

    this.logger.log(`Password reset for ${email}: ${link}`);

    return {
      message: `Password reset email sent to ${email}`,
      resetLink: link,
    };
  }

  /**
   * Logout
   */
  async logout(sessionId: number) {
    if (!sessionId) {
      throw new BadRequestException('sessionId required');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revoked: true },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { revoked: true },
    });

    return { message: 'Logout successful' };
  }

  /**
   * Internal token generator
   */
  private generateToken(user: any) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ===========================
  // OTP LOGIN (DUMMY SMS)
  // ===========================
  async sendOtp(data: { phone: string; role?: UserRole }) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    await this.prisma.user.upsert({
      where: { phone: data.phone },
      create: {
        phone: data.phone,
        name: 'New User',
        role: data.role || UserRole.CUSTOMER,
        status: 'APPROVED',
        otpCode: otp,
        otpExpiresAt: addHours(new Date(), 1),
      },
      update: {
        otpCode: otp,
        otpExpiresAt: addHours(new Date(), 1),
      },
    });

    this.logger.log(`DUMMY SMS OTP for ${data.phone}: ${otp}`);

    return { message: 'OTP sent successfully (dummy mode)' };
  }

  async verifyOtp(
    data: { phone: string; otp: string; role?: UserRole },
    ip: string,
    ua: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (!user || user.otpCode !== data.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null },
    });

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip,
        userAgent: ua,
        expiresAt: addHours(new Date(), 12),
      },
    });

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const hashedRefresh = crypto
      .createHash('sha256')
      .update(rawRefresh)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashedRefresh,
        expiresAt: addHours(new Date(), 48),
      },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      sessionId: session.id,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  // ===========================
  // GOOGLE LOGIN
  // ===========================
  async googleLogin(googleUser: { email: string; googleId: string; name: string }) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          googleId: googleUser.googleId,
          email: googleUser.email,
          name: googleUser.name,
          role: UserRole.CUSTOMER,
          status: 'APPROVED',
        },
      });
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: null,
        userAgent: 'google-oauth',
        expiresAt: addHours(new Date(), 12),
      },
    });

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const hashedRefresh = crypto
      .createHash('sha256')
      .update(rawRefresh)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashedRefresh,
        expiresAt: addHours(new Date(), 48),
      },
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      sessionId: session.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
