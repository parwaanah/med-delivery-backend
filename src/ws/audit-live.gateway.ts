import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/audit-live',
})
export class AuditLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server; // ✅ fixed: definite assignment assertion

  private readonly logger = new Logger(AuditLiveGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`🟢 Admin connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Admin disconnected: ${client.id}`);
  }

  /**
   * 🔔 Emit audit events to all connected clients
   */
  emitAuditEvent(event: any) {
    if (!this.server) return;
    this.server.emit('audit_event', event);
    this.logger.debug(`📡 Emitted audit event: ${JSON.stringify(event)}`);
  }
}
