import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

// Correct paths based on your project
import { PrismaService } from '../utils/prisma.service';
import { AuditService } from '../utils/audit.service';

import { AuditLiveGateway } from '../ws/audit-live.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '1h' },
    }),

    // Notification module exists
    NotificationsModule,
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,

    // Correct providers
    PrismaService,
    AuditService,
    AuditLiveGateway,
  ],

  exports: [AuthService],
})
export class AuthModule {}
