import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { WsModule } from '../ws/ws.module'; // ✅ correct import

@Module({
  imports: [WsModule], // ✅ gives access to WsGateway, etc.
  providers: [PrismaService, AuditService, NotificationService],
  exports: [PrismaService, AuditService, NotificationService],
})
export class UtilsModule {}
