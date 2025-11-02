// src/ws/ws.gateway.ts
import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    // client should send "join" with userId after connecting
    client.on('join', (payload: { userId: number }) => {
      client.join(`user-${payload.userId}`);
    });
  }

  handleDisconnect(client: Socket) {
    // noop
  }

  notifyUser(userId: number, event: string, payload: any) {
    try {
      this.server.to(`user-${userId}`).emit(event, payload);
    } catch (err) {
      // swallow
    }
  }

  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}
