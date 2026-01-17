// src/auth/auth.module.ts
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { GoogleStrategy } from "./google.strategy";

import { PrismaService } from "../utils/prisma.service";
import { AuditModule } from "../utils/audit.module"; // ✅ CORRECT

import { NotificationsModule } from "../notifications/notifications.module";
import { ProfileModule } from "./profile.module";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret",
      signOptions: { expiresIn: "1h" },
    }),
    NotificationsModule,
    ProfileModule,
    AuditModule, // ✅ ONLY THIS
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
