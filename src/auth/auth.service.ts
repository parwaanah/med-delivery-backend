import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { authenticator } from "otplib";
import { addHours, addMinutes, isBefore } from "date-fns";
import { PrismaService } from "../utils/prisma.service";
import { CacheService } from "../cache/cache.service";
import { LoginDto, RegisterDto, VerifyOtpDto, SendOtpDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from "./dto/auth.dto";
import { AuditService } from "../utils/audit.service";
import { UserRole } from "@prisma/client";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
    private cache: CacheService,
  ) {}

  // ================= REGISTER =================
  async register(data: RegisterDto) {
    if (!data.name || !data.password) {
      throw new BadRequestException("Name and password required");
    }

    const email = data.email ? String(data.email).trim().toLowerCase() : null;
    const phone = data.phone ? String(data.phone).trim() : null;

    if (!email && !phone) {
      throw new BadRequestException("Either email or phone is required");
    }

    if (email) {
      const existsEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (existsEmail) throw new BadRequestException("Email already in use");
    }

    if (phone) {
      const existsPhone = await this.prisma.user.findUnique({
        where: { phone },
      });
      if (existsPhone) throw new BadRequestException("Phone already in use");
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const role = (data.role as UserRole) || UserRole.CUSTOMER;

    const emailToken = email ? crypto.randomBytes(20).toString("hex") : null;
    const emailExpiry = email ? addHours(new Date(), 24) : null;

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email,
        phone,
        password: hashed,
        role,
        status: role === UserRole.CUSTOMER ? "APPROVED" : "PENDING",
        emailVerified: false,
        phoneVerified: false,
        otpCode: emailToken,
        otpExpiresAt: emailExpiry,
      },
    });

    if (emailToken) {
      this.logEmailVerificationLink(user, emailToken);
    }

    return this.issueTokens(user);
  }

  // ================= LOGIN =================
  async login(data: LoginDto, ip?: string, ua?: string) {
    const email = data?.email ? String(data.email).trim().toLowerCase() : null;
    const phone = data?.phone ? String(data.phone).trim() : null;

    if (!email && !phone) {
      throw new BadRequestException("Either email or phone is required");
    }

    const ident = email ? `email:${email}` : `phone:${phone}`;
    const failKey = `auth.fail:${ident}`;
    const lockKey = `auth.lock:${ident}`;
    const lockTtlMs = 15 * 60_000;
    const maxFails = 5;

    if (this.cache.get(lockKey)) {
      throw new UnauthorizedException("Too many attempts. Try again later.");
    }

    const user = email
      ? await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        })
      : await this.prisma.user.findUnique({ where: { phone: phone! } });

    if (!user || !user.password) {
      const fails = (this.cache.get<number>(failKey) || 0) + 1;
      this.cache.set(failKey, fails, lockTtlMs);
      if (fails >= maxFails) this.cache.set(lockKey, true, lockTtlMs);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Customers must verify email (your existing behavior)
    if (user.role === UserRole.CUSTOMER && !user.emailVerified) {
      throw new UnauthorizedException("Please verify your email");
    }

    // ✅ Approval gate: Pharmacy/Rider cannot login unless APPROVED
    // Allow PHARMACY/RIDER to login while pending so they can complete profile/docs.
    // Access control for sensitive actions should be enforced via guards/permissions.

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) {
      const fails = (this.cache.get<number>(failKey) || 0) + 1;
      this.cache.set(failKey, fails, lockTtlMs);
      if (fails >= maxFails) this.cache.set(lockKey, true, lockTtlMs);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Approval gate handled by guards; allow login for onboarding.

    await this.assertMfa(user, data.mfaCode, data.recoveryCode);

    this.cache.del(failKey);
    this.cache.del(lockKey);

    if (email && user.email && !user.emailVerified) {
      throw new UnauthorizedException("Please verify your email");
    }
    if (phone && user.phone && !user.phoneVerified) {
      throw new UnauthorizedException("Please verify your phone");
    }

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

  // ================= GOOGLE LOGIN =================
  async loginWithGoogle(profile: {
    googleId: string;
    email: string;
    name: string;
    photo?: string | null;
  }, ip?: string, ua?: string) {
    const email = String(profile.email || "").trim().toLowerCase();
    if (!email) throw new UnauthorizedException("Google profile incomplete");

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { googleId: profile.googleId },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
    });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: profile.googleId,
            email,
            emailVerified: true,
            name: existing.name || profile.name || "Google User",
          },
        })
      : await this.prisma.user.create({
          data: {
            name: profile.name || "Google User",
            email,
            googleId: profile.googleId,
            role: UserRole.CUSTOMER,
            status: "APPROVED",
            emailVerified: true,
            phoneVerified: false,
          },
        });

    this.enforceVerification(user);

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

    // ✅ If rider/pharmacy logs in by OTP, enforce approval too
    if (user.role === UserRole.PHARMACY && user.status !== "APPROVED") {
      throw new UnauthorizedException("ACCOUNT_NOT_APPROVED");
    }
    if (
      user.role === UserRole.RIDER &&
      !["ACTIVE", "OFFLINE", "APPROVED"].includes(
        String(user.status || "").toUpperCase(),
      )
    ) {
      throw new UnauthorizedException("ACCOUNT_NOT_APPROVED");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        phoneVerified: true,
      },
    });

    this.enforceVerification({ ...user, phoneVerified: true });
    await this.assertMfa(user, data.mfaCode, data.recoveryCode);

    return this.issueTokens(user);
  }


  // ================= LOGIN VIA OTP =================
  async sendLoginOtp(data: SendOtpDto) {
    const phone = String(data?.phone || "").trim();
    if (!phone) throw new BadRequestException("Phone required");

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new BadRequestException("Phone not registered");

    if (!user.phoneVerified) {
      throw new UnauthorizedException("Please verify your phone");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = addMinutes(new Date(), 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiresAt: expiresAt },
    });

    const includeOtp = process.env.RETURN_OTP === "1";
    return {
      message: "OTP sent",
      ...(includeOtp ? { otp } : {}),
    };
  }

  async loginWithOtp(data: VerifyOtpDto, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (!user || user.otpCode !== data.otp) {
      throw new UnauthorizedException("Invalid OTP");
    }

    if (user.otpExpiresAt && isBefore(user.otpExpiresAt, new Date())) {
      throw new UnauthorizedException("OTP expired");
    }

    if (!user.phoneVerified) {
      throw new UnauthorizedException("Please verify your phone");
    }

    if (user.role === UserRole.PHARMACY && user.status !== "APPROVED") {
      throw new UnauthorizedException("ACCOUNT_NOT_APPROVED");
    }
    if (
      user.role === UserRole.RIDER &&
      !["ACTIVE", "OFFLINE", "APPROVED"].includes(
        String(user.status || "").toUpperCase(),
      )
    ) {
      throw new UnauthorizedException("ACCOUNT_NOT_APPROVED");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    this.enforceVerification(user);
    await this.assertMfa(user, data.mfaCode, data.recoveryCode);

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

  // ================= SEND OTP =================
  async sendOtp(data: SendOtpDto) {
    const phone = String(data?.phone || "").trim();
    if (!phone) throw new BadRequestException("Phone required");

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new BadRequestException("Phone not registered");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = addHours(new Date(), 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiresAt: expiresAt },
    });

    // In production you should send OTP via SMS provider.
    // For dev/testing we optionally return it if RETURN_OTP=1.
    const includeOtp = process.env.RETURN_OTP === "1";
    return {
      message: "OTP sent",
      ...(includeOtp ? { otp } : {}),
    };
  }

  // ================= FORGOT PASSWORD =================
  async sendEmailVerification(data: { email: string }) {
    const email = String(data?.email || "").trim().toLowerCase();
    if (!email) throw new BadRequestException("Email required");

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) throw new BadRequestException("Email not registered");

    const token = crypto.randomBytes(20).toString("hex");
    const expiresAt = addHours(new Date(), 24);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: token, otpExpiresAt: expiresAt },
    });

    this.logEmailVerificationLink(user, token);
    return { message: "Verification email sent" };
  }


  async forgotPassword(data: ForgotPasswordDto) {
    if (!data?.email && !data?.phone) {
      throw new BadRequestException("Either email or phone is required");
    }

    const email = data.email ? String(data.email).trim().toLowerCase() : null;
    const phone = data.phone ? String(data.phone).trim() : null;

    const user = email
      ? await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        })
      : await this.prisma.user.findUnique({ where: { phone: phone! } });

    // Avoid account enumeration
    if (!user) {
      return { message: "If the account exists, a reset code has been sent." };
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = addMinutes(new Date(), 15);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiresAt: expiresAt },
    });

    // In production, send via email/SMS provider.
    // For dev/testing we optionally return it if RETURN_OTP=1.
    const includeOtp = process.env.RETURN_OTP === "1";

    await this.audit.log({
      userId: user.id,
      email: user.email ?? undefined,
      role: user.role,
      eventType: "PASSWORD_RESET_OTP_SENT",
      success: true,
      meta: {
        via: data.email ? "email" : "phone",
      },
    });

    return {
      message: "If the account exists, a reset code has been sent.",
      ...(includeOtp ? { otp } : {}),
    };
  }

  // ================= RESET PASSWORD =================
  async resetPassword(data: ResetPasswordDto) {
    if (!data?.email && !data?.phone) {
      throw new BadRequestException("Either email or phone is required");
    }
    if (!data?.otp) throw new BadRequestException("OTP required");
    if (!data?.newPassword) throw new BadRequestException("New password required");

    const email = data.email ? String(data.email).trim().toLowerCase() : null;
    const phone = data.phone ? String(data.phone).trim() : null;

    const user = email
      ? await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        })
      : await this.prisma.user.findUnique({ where: { phone: phone! } });

    if (!user) {
      throw new UnauthorizedException("Invalid OTP");
    }

    if (!user.otpCode || user.otpCode !== data.otp) {
      throw new UnauthorizedException("Invalid OTP");
    }

    if (user.otpExpiresAt && isBefore(user.otpExpiresAt, new Date())) {
      throw new UnauthorizedException("OTP expired");
    }

    const hashed = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, otpCode: null, otpExpiresAt: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true },
      }),
    ]);

    await this.audit.log({
      userId: user.id,
      email: user.email ?? undefined,
      role: user.role,
      eventType: "PASSWORD_RESET_COMPLETED",
      success: true,
    });

    return { message: "Password updated successfully" };
  }

  // ================= CHANGE PASSWORD =================
  async changePassword(userId: number, data: ChangePasswordDto) {
    if (!data?.currentPassword)
      throw new BadRequestException("Current password required");
    if (!data?.newPassword)
      throw new BadRequestException("New password required");

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new UnauthorizedException("Invalid user");
    }

    const match = await bcrypt.compare(data.currentPassword, user.password);
    if (!match) throw new UnauthorizedException("Current password incorrect");

    await this.assertMfa(
      user,
      data.mfaCode || undefined,
      data.recoveryCode || undefined,
    );

    const hashed = await bcrypt.hash(data.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashed, otpCode: null, otpExpiresAt: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.session.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    await this.audit.log({
      userId,
      email: user.email ?? undefined,
      role: user.role,
      eventType: "PASSWORD_CHANGE",
      success: true,
    });

    return { message: "Password changed. Please sign in again." };
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
        phone: user.phone,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  // ================= ADMIN IMPERSONATION =================
  async issueImpersonationToken(adminId: number, targetUserId: number) {
    if (!Number.isFinite(adminId) || !Number.isFinite(targetUserId)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
      },
    });
    if (!user) throw new BadRequestException('User not found');

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role, impersonatedBy: adminId },
      { expiresIn: '15m' },
    );

    await this.audit.logAdminAction({
      userId: adminId,
      action: 'ADMIN_IMPERSONATE',
      resource: `user:${user.id}`,
    });

    return { accessToken, user, impersonatedBy: adminId };
  }
  // ================= MFA =================
  async setupMfa(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    if (user.mfaEnabled) {
      throw new BadRequestException("MFA already enabled");
    }

    const secret = authenticator.generateSecret();
    const label = user.email || user.phone || `user-${user.id}`;
    const otpauthUrl = authenticator.keyuri(label, "Uskery", secret);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaTempSecret: secret },
    });

    return { secret, otpauthUrl };
  }

  async verifyMfa(userId: number, code: string) {
    if (!code) throw new BadRequestException("Code required");
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaTempSecret) {
      throw new BadRequestException("MFA setup not initialized");
    }

    const isValid = authenticator.check(code, user.mfaTempSecret);
    if (!isValid) throw new UnauthorizedException("Invalid MFA code");

    const recoveryCodes = this.generateRecoveryCodes();
    const hashed = recoveryCodes.map((c) => this.hashRecoveryCode(c));

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaSecret: user.mfaTempSecret,
        mfaTempSecret: null,
        mfaRecoveryCodes: hashed,
      },
    });

    return { recoveryCodes };
  }

  async disableMfa(userId: number, data: { code?: string; recoveryCode?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException("MFA not enabled");
    }

    await this.assertMfa(user, data.code, data.recoveryCode);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaTempSecret: null,
        mfaRecoveryCodes: [],
      },
    });

    return { message: "MFA disabled" };
  }

  private enforceVerification(user: { email?: string | null; phone?: string | null; emailVerified?: boolean; phoneVerified?: boolean }) {
    if (user.email && !user.emailVerified) {
      throw new UnauthorizedException("Please verify your email");
    }
    if (user.phone && !user.phoneVerified) {
      throw new UnauthorizedException("Please verify your phone");
    }
  }

  private async assertMfa(
    user: { id: number; mfaEnabled?: boolean; mfaSecret?: string | null; mfaRecoveryCodes?: string[] | null },
    code?: string,
    recoveryCode?: string,
  ) {
    if (!user.mfaEnabled) return;

    const normalizedRecovery = String(recoveryCode || "").trim();
    if (normalizedRecovery) {
      const hashed = this.hashRecoveryCode(normalizedRecovery);
      const stored = user.mfaRecoveryCodes || [];
      if (stored.includes(hashed)) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            mfaRecoveryCodes: stored.filter((c) => c !== hashed),
          },
        });
        return;
      }
    }

    if (!code || !user.mfaSecret) {
      throw new UnauthorizedException("MFA_REQUIRED");
    }

    const ok = authenticator.check(String(code), user.mfaSecret);
    if (!ok) {
      throw new UnauthorizedException("Invalid MFA code");
    }
  }

  private generateRecoveryCodes() {
    const codes: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const raw = crypto.randomBytes(5).toString("hex");
      codes.push(raw);
    }
    return codes;
  }

  private hashRecoveryCode(code: string) {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  private logEmailVerificationLink(user: { email?: string | null }, token: string) {
    const base = String(process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
    const link = `${base}/verify-email?token=${encodeURIComponent(token)}`;
    this.logger.log(`Email verification link for ${user.email}: ${link}`);
  }

}
