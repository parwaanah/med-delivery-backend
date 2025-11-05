import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { AuditLiveGateway } from './audit-live.gateway';
import { QueueLiveGateway } from './queue-live.gateway';

@Module({
  providers: [WsGateway, AuditLiveGateway, QueueLiveGateway],
  exports: [WsGateway, AuditLiveGateway, QueueLiveGateway], // ✅ export all
})
export class WsModule {}
