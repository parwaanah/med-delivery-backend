import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto, VerifyOtpDto, SendOtpDto, ForgotPasswordDto, ResetPasswordDto, MfaVerifyDto, MfaDisableDto, SendEmailVerificationDto, ChangePasswordDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RateLimit } from "../common/decorators/rate-limit.decorator";
import { RateLimitGuard } from "../common/guards/rate-limit.guard";

function readCookie(rawCookieHeader: unknown, name: string): string | null {
  const header = typeof rawCookieHeader === "string" ? rawCookieHeader : "";
  if (!header) return null;
  const parts = header.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (!k) continue;
    if (k === name) {
      const v = rest.join("=");
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

function cookieModeEnabled() {
  return String(process.env.AUTH_COOKIE_MODE || "").trim() === "1";
}

function cookieOptions() {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
  };
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ================= REGISTER =================
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // ================= LOGIN =================
  @Post("login")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.login", limit: 10, windowMs: 10 * 60_000 })
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    const out = await this.auth.login(
      dto,
      req.ip,
      String(req.headers["user-agent"] || ""),
    );

    if (cookieModeEnabled()) {
      res.cookie("uskery_auth", out.accessToken, {
        ...cookieOptions(),
        maxAge: 15 * 60 * 1000,
      });
      res.cookie("uskery_refresh", out.refreshToken, {
        ...cookieOptions(),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      user: out.user,
      access_token: out.accessToken,
      refresh_token: out.refreshToken,
    };
  }

  // ================= GOOGLE LOGIN =================
  @Get("google")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.google", limit: 20, windowMs: 10 * 60_000 })
  @UseGuards(AuthGuard("google"))
  googleAuth() {
    return;
  }

  @Get("google/callback")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.google.cb", limit: 20, windowMs: 10 * 60_000 })
  @UseGuards(AuthGuard("google"))
  async googleCallback(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const out = await this.auth.loginWithGoogle(
      req.user,
      req.ip,
      String(req.headers["user-agent"] || ""),
    );

    if (cookieModeEnabled()) {
      res.cookie("uskery_auth", out.accessToken, {
        ...cookieOptions(),
        maxAge: 15 * 60 * 1000,
      });
      res.cookie("uskery_refresh", out.refreshToken, {
        ...cookieOptions(),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    const payload = encodeURIComponent(
      JSON.stringify({
        accessToken: out.accessToken,
        refreshToken: out.refreshToken,
        user: out.user,
      }),
    );

    const redirect =
      typeof req.query?.redirect === "string" ? req.query.redirect : "";
    const redirectParam = redirect
      ? `&redirect=${encodeURIComponent(redirect)}`
      : "";

    return res.redirect(
      `${frontendUrl()}/auth/google/callback?data=${payload}${redirectParam}`,
    );
  }

  // ================= REFRESH =================
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body("refresh_token") token?: string,
  ) {
    const t =
      token ||
      (cookieModeEnabled() ? readCookie(req.headers["cookie"], "uskery_refresh") : null);
    if (!t) throw new UnauthorizedException("No refresh token");

    const out = await this.auth.refresh(t);

    if (cookieModeEnabled()) {
      res.cookie("uskery_auth", out.accessToken, {
        ...cookieOptions(),
        maxAge: 15 * 60 * 1000,
      });
      if (out.refreshToken) {
        res.cookie("uskery_refresh", out.refreshToken, {
          ...cookieOptions(),
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }
    }

    return {
      user: out.user,
      access_token: out.accessToken,
      refresh_token: out.refreshToken,
    };
  }

  // ================= LOGOUT =================
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    if (cookieModeEnabled()) {
      res.clearCookie("uskery_auth", cookieOptions());
      res.clearCookie("uskery_refresh", cookieOptions());
    }
    return this.auth.logout(req.user.id);
  }

  // ================= VERIFY EMAIL =================
  @Get("verify-email")
  verifyEmail(@Query("token") token: string) {
    return this.auth.verifyEmail(token);
  }

  // ================= VERIFY OTP =================
  @Post("verify-otp")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.verify-otp", limit: 10, windowMs: 10 * 60_000 })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  // ================= MFA =================
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post("mfa/setup")
  @RateLimit({ key: "auth.mfa.setup", limit: 5, windowMs: 10 * 60_000 })
  setupMfa(@Req() req: any) {
    return this.auth.setupMfa(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post("mfa/verify")
  @RateLimit({ key: "auth.mfa.verify", limit: 10, windowMs: 10 * 60_000 })
  verifyMfa(@Req() req: any, @Body() dto: MfaVerifyDto) {
    return this.auth.verifyMfa(req.user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post("mfa/disable")
  @RateLimit({ key: "auth.mfa.disable", limit: 5, windowMs: 10 * 60_000 })
  disableMfa(@Req() req: any, @Body() dto: MfaDisableDto) {
    return this.auth.disableMfa(req.user.id, dto);
  }

  // ================= LOGIN VIA OTP =================
  @Post("send-login-otp")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.send-login-otp", limit: 5, windowMs: 10 * 60_000 })
  sendLoginOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendLoginOtp(dto);
  }

  @Post("login-otp")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.login-otp", limit: 10, windowMs: 10 * 60_000 })
  async loginOtp(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: VerifyOtpDto,
  ) {
    const out = await this.auth.loginWithOtp(
      dto,
      req.ip,
      String(req.headers["user-agent"] || ""),
    );

    if (cookieModeEnabled()) {
      res.cookie("uskery_auth", out.accessToken, {
        ...cookieOptions(),
        maxAge: 15 * 60 * 1000,
      });
      res.cookie("uskery_refresh", out.refreshToken, {
        ...cookieOptions(),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }

    return {
      user: out.user,
      access_token: out.accessToken,
      refresh_token: out.refreshToken,
    };
  }

  // ================= SEND OTP =================
  @Post("send-otp")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.send-otp", limit: 5, windowMs: 10 * 60_000 })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto);
  }

  @Post("send-email-verification")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.send-email-verification", limit: 5, windowMs: 10 * 60_000 })
  sendEmailVerification(@Body() dto: SendEmailVerificationDto) {
    return this.auth.sendEmailVerification(dto);
  }

  // ================= FORGOT PASSWORD =================
  @Post("forgot-password")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.forgot-password", limit: 5, windowMs: 10 * 60_000 })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  // ================= RESET PASSWORD =================
  @Post("reset-password")
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: "auth.reset-password", limit: 5, windowMs: 10 * 60_000 })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  // ================= CHANGE PASSWORD =================
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @Post("change-password")
  @RateLimit({ key: "auth.change-password", limit: 5, windowMs: 10 * 60_000 })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.id, dto);
  }
}
