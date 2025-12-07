import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';

import { PrismaService } from '../utils/prisma.service';
import { AuditService } from '../utils/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLiveGateway } from '../ws/audit-live.gateway';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '1h' },
    }),

    NotificationsModule,
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    PrismaService,
    AuditService,
    AuditLiveGateway,
  ],

  exports: [AuthService],
})
export class AuthModule {}
