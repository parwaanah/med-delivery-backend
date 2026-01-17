import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { addHours, isBefore } from "date-fns";
import { PrismaService } from "../utils/prisma.service";
import { LoginDto, RegisterDto, VerifyOtpDto } from "./dto/auth.dto";
import { AuditService } from "../utils/audit.service";
import { UserRole } from "@prisma/client";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
  ) {}

  // ================= REGISTER =================
  async register(data: RegisterDto) {
    if (!data.name || !data.email || !data.password) {
      throw new BadRequestException("Name, email and password required");
    }

    const exists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (exists) throw new BadRequestException("Email already in use");

    const hashed = await bcrypt.hash(data.password, 10);
    const role = (data.role as UserRole) || UserRole.CUSTOMER;

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role,
        status: role === UserRole.CUSTOMER ? "APPROVED" : "PENDING",
        emailVerified: role !== UserRole.CUSTOMER,
      },
    });

    return this.issueTokens(user);
  }

  // ================= LOGIN =================
  async login(data: LoginDto, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.role === UserRole.CUSTOMER && !user.emailVerified) {
      throw new UnauthorizedException("Please verify your email");
    }

    // ✅ Option B: allow login even if PENDING

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) throw new UnauthorizedException("Invalid credentials");

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: ip || null,
        userAgent: ua || null,
        expiresAt: addHours(new Date(), 12),
      },
    });

    return this.issueTokens(user, session.id, ip, ua);
  }

  // ================= VERIFY EMAIL =================
  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException("Missing token");

    const user = await this.prisma.user.findFirst({
      where: { otpCode: token },
    });

    if (!user) throw new BadRequestException("Invalid verification token");

    if (user.otpExpiresAt && isBefore(user.otpExpiresAt, new Date())) {
      throw new BadRequestException("Verification token expired");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    return { message: "Email verified successfully" };
  }

  // ================= VERIFY OTP =================
  async verifyOtp(data: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (!user || user.otpCode !== data.otp) {
      throw new UnauthorizedException("Invalid OTP");
    }

    if (user.otpExpiresAt && isBefore(user.otpExpiresAt, new Date())) {
      throw new UnauthorizedException("OTP expired");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        phoneVerified: true,
      },
    });

    return this.issueTokens(user);
  }

  // ================= REFRESH =================
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const hash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revoked: false },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(stored.user, stored.sessionId ?? undefined);
  }

  // ================= LOGOUT =================
  async logout(userId: number) {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.session.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    return { message: "Logged out successfully" };
  }

  // ================= TOKEN ISSUER =================
  private async issueTokens(
    user: any,
    sessionId?: number,
    ip?: string,
    ua?: string,
  ) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    const rawRefresh = crypto.randomBytes(32).toString("hex");
    const hashed = crypto
      .createHash("sha256")
      .update(rawRefresh)
      .digest("hex");

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId,
        tokenHash: hashed,
        expiresAt: addHours(new Date(), 48),
      },
    });

    await this.audit.log({
      userId: user.id,
      email: user.email,
      role: user.role,
      eventType: "SESSION_ISSUED",
      success: true,
      ip,
      userAgent: ua,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }
}
