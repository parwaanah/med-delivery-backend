import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [WsModule], // WsGateway available here
  providers: [AuditService, PrismaService],
  exports: [AuditService],
})
export class AuditModule {}
