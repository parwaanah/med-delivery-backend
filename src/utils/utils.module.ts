// src/utils/utils.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { JwtBlacklistService } from './jwt-blacklist.service';
import { WsModule } from '../ws/ws.module'; // ✅ imports global WebSocket providers

@Global()
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
