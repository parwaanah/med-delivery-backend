// src/ws/audit-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WsAuthService } from './ws-auth.service';
import { getWsCorsOrigin } from '../utils/cors';

const wsCorsOrigin: any = getWsCorsOrigin();

@WebSocketGateway({
  cors: { origin: wsCorsOrigin },
  namespace: '/audit-live',
})
export class AuditLiveGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AuditLiveGateway.name);

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket) {
    const user = await this.wsAuth.authenticate(client);
    const role = String(user?.role || '').toUpperCase();
    if (!user || role !== 'ADMIN') {
      client.disconnect(true);
      return;
    }

    (client.data as any).user = user;
  }

  emitAuditEvent(event: any) {
    try {
      this.server.emit('audit_event', event);
    } catch (err) {
      this.logger.warn('Audit WS broadcast failed:', err);
    }
  }
}
