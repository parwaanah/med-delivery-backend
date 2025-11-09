import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/audit-live',
})
export class AuditLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AuditLiveGateway.name);

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.headers['authorization']?.toString().split(' ')[1];
      if (!token) {
        this.logger.warn(`❌ Connection rejected: Missing token`);
        client.disconnect(true);
        return;
      }

      const decoded = this.jwt.verify(token);
      this.logger.log(`🟢 ${decoded.role} connected: ${client.id}`);
      client.emit('welcome', { event: 'connected', role: decoded.role, userId: decoded.sub });
    } catch (err: any) {
      this.logger.warn(`❌ Invalid token: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Disconnected: ${client.id}`);
  }

  emitAuditEvent(event: any) {
    if (!this.server) return;
    this.server.emit('audit_event', event);
    this.logger.debug(`📡 Audit event → ${JSON.stringify(event)}`);
  }
}
