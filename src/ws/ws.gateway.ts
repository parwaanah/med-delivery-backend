// src/ws/ws.gateway.ts
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
  namespace: '/',
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);
  private users = new Map<number, string>();
  private admins = new Set<string>();

  handleConnection(client: Socket) {
    const userId = Number(client.handshake.query.userId);
    const role = (client.handshake.query.role as string)?.toUpperCase() ?? 'UNKNOWN';

    if (!isNaN(userId)) this.users.set(userId, client.id);
    if (role === 'ADMIN') this.admins.add(client.id);

    this.logger.log(`WS connected: ${client.id} user=${userId} role=${role}`);
  }

  handleDisconnect(client: Socket) {
    this.users.forEach((sid, uid) => {
      if (sid === client.id) this.users.delete(uid);
    });
    this.admins.delete(client.id);
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  notifyUser(userId: number, event: string, payload: any) {
    const socketId = this.users.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, payload);
    }
  }

  notifyAdmins(event: string, payload: any) {
    for (const sid of this.admins) {
      this.server.to(sid).emit(event, payload);
    }
  }

  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}
