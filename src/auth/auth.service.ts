import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { addHours, isBefore } from 'date-fns';
import { PrismaService } from '../utils/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuditService } from '../utils/audit.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
  ) {}

  async register(data: RegisterDto) {
    if (!data.email || !data.password || !data.name)
      throw new BadRequestException('Name, email, and password required');

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new BadRequestException('Email already in use');

    const hashed = await bcrypt.hash(data.password, 10);

    const normalizedRole = (data.role as UserRole) || UserRole.CUSTOMER;
    const isCustomer = normalizedRole === UserRole.CUSTOMER;
    const autoStatus = isCustomer ? 'APPROVED' : 'PENDING';

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: normalizedRole,
        status: autoStatus,
      },
    });

    await this.audit.log({
      userId: user.id,
      email: user.email,
      role: user.role,
      eventType: 'REGISTER_SUCCESS',
      success: true,
    });

    return this.generateToken(user);
  }

  async login(data: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'APPROVED')
      throw new UnauthorizedException('Account pending admin approval');

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: ip || null,
        userAgent: userAgent ? String(userAgent) : null,
        expiresAt: addHours(new Date(), 12),
      },
    });

    const refreshTokenRaw = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: refreshTokenHash,
        expiresAt: addHours(new Date(), 48),
      },
    });

    await this.audit.log({
      userId: user.id,
      email: user.email,
      eventType: 'LOGIN_SUCCESS',
      success: true,
    });

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn: '1h' });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      sessionId: session.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refreshToken(oldToken: string) {
    if (!oldToken) throw new UnauthorizedException('Missing token');

    const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: oldHash, revoked: false },
      include: { session: true },
    });

    if (!existing || !existing.session)
      throw new UnauthorizedException('Invalid refresh token');

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

    const newTokenRaw = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newTokenRaw).digest('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: existing.session.userId,
        sessionId: existing.session.id,
        tokenHash: newTokenHash,
        expiresAt: addHours(new Date(), 48),
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: existing.session.userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn: '1h' });
    return { accessToken, refreshToken: newTokenRaw, sessionId: existing.session.id };
  }

  async logout(sessionId: number) {
    if (!sessionId) throw new BadRequestException('sessionId required');
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

  async requestPasswordReset(email: string) {
    if (!email) throw new BadRequestException('Email is required');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException(`No user found with email: ${email}`);
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetLink = `https://your-frontend-url/reset-password?token=${resetToken}`;

    this.logger.log(`Password reset requested for ${email}`);
    this.logger.log(`Mock reset link: ${resetLink}`);

    return {
      message: `Password reset email sent to ${email}`,
      email,
      resetLink,
      timestamp: new Date().toISOString(),
    };
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
