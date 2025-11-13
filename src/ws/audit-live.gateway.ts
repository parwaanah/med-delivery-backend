// src/ws/audit-live.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/audit-live',
})
export class AuditLiveGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AuditLiveGateway.name);

  emitAuditEvent(event: any) {
    try {
      this.server.emit('audit_event', event);
    } catch (err) {
      this.logger.warn('Audit WS broadcast failed:', err);
    }
  }
}
