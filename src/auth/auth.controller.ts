import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto, VerifyOtpDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

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
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const res = await this.auth.login(
      dto,
      req.ip,
      String(req.headers["user-agent"] || ""),
    );

    return {
      user: res.user,
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
    };
  }

  // ================= REFRESH =================
  @Post("refresh")
  async refresh(@Body("refresh_token") token: string) {
    const res = await this.auth.refresh(token);
    return {
      user: res.user,
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
    };
  }

  // ================= LOGOUT =================
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Req() req: any) {
    return this.auth.logout(req.user.id);
  }

  // ================= VERIFY EMAIL =================
  @Get("verify-email")
  verifyEmail(@Query("token") token: string) {
    return this.auth.verifyEmail(token);
  }

  // ================= VERIFY OTP =================
  @Post("verify-otp")
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }
}
