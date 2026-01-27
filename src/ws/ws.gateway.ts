// src/ws/ws.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WsAuthService } from './ws-auth.service';
import { getWsCorsOrigin } from '../utils/cors';

const wsCorsOrigin: any = getWsCorsOrigin();

@WebSocketGateway({
  cors: { origin: wsCorsOrigin },
  namespace: '/',
})
export class WsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);
  private users = new Map<number, string>();
  private admins = new Set<string>();
  private riders = new Set<string>();

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket) {
    const user = await this.wsAuth.authenticate(client);
    if (!user) {
      client.disconnect(true);
      return;
    }

    (client.data as any).user = user;

    this.users.set(user.id, client.id);

    const role = String(user.role || '').toUpperCase();
    if (role === 'ADMIN') this.admins.add(client.id);
    if (role === 'RIDER') this.riders.add(client.id);

    this.logger.log(`WS connected: ${client.id} user=${user.id} role=${role}`);
  }

  handleDisconnect(client: Socket) {
    this.users.forEach((sid, uid) => {
      if (sid === client.id) this.users.delete(uid);
    });
    this.admins.delete(client.id);
    this.riders.delete(client.id);
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

  notifyRiders(event: string, payload: any) {
    for (const sid of this.riders) {
      this.server.to(sid).emit(event, payload);
    }
  }

  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}
