// src/utils/utils.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import { AuditService } from './audit.service';
import { JwtBlacklistService } from './jwt-blacklist.service';
import { RedisService } from './redis.service';
import { LockService } from './lock.service';
import { WsModule } from '../ws/ws.module';
import { DataRetentionService } from './data-retention.service';

@Global()
@Module({
  imports: [WsModule],
  providers: [
    PrismaService,
    NotificationService,
    AuditService,
    JwtBlacklistService,
    RedisService,
    LockService,
    DataRetentionService,
  ],
  exports: [
    PrismaService,
    NotificationService,
    AuditService,
    JwtBlacklistService,
    RedisService,
    LockService,
  ],
})
export class UtilsModule {}
