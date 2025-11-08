// src/ws/ws.module.ts
import { Module, Global } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { AuditLiveGateway } from './audit-live.gateway';
import { RiderLiveGateway } from './rider-live.gateway';
import { SurgeLiveGateway } from './surge-live.gateway';
import { PrismaService } from '../utils/prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    WsGateway,
    AuditLiveGateway,
    RiderLiveGateway,
    SurgeLiveGateway,
  ],
  exports: [
    WsGateway,
    AuditLiveGateway,
    RiderLiveGateway,
    SurgeLiveGateway,
  ],
})
export class WsModule {}
