// src/utils/utils.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { JwtBlacklistService } from './jwt-blacklist.service';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [WsModule],
  providers: [
    PrismaService,
    NotificationService,
    AuditService,
    JwtBlacklistService,
  ],
  exports: [
    PrismaService,
    NotificationService,
    AuditService,
    JwtBlacklistService,
  ],
})
export class UtilsModule {}
