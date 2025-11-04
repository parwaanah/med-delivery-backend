import { Module, Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminAuditGateway } from './admin.audit.gateway';
import { PrismaService } from '../utils/prisma.service'; // ✅

@WebSocketGateway({ cors: { origin: '*' } }) // Main user socket namespace
@Injectable()
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    // Join user-specific room (used for personal notifications)
    client.on('join', (payload: { userId: number }) => {
      client.join(`user-${payload.userId}`);
    });

    client.on('disconnect', () => {
      client.rooms.forEach((room) => {
        if (room.startsWith('user-')) {
          client.leave(room);
        }
      });
    });
  }

  handleDisconnect(client: Socket) {
    // For clarity/logging (optional)
    // console.log(`🔴 User disconnected: ${client.id}`);
  }

  notifyUser(userId: number, event: string, payload: any) {
    try {
      this.server.to(`user-${userId}`).emit(event, payload);
    } catch (err) {
      console.warn(`⚠️ Failed to notify user ${userId}:`, err);
    }
  }

  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}

@Module({
  providers: [
    PrismaService, // ✅ Make Prisma available here
    AdminAuditGateway,
    WsGateway,
  ],
  exports: [AdminAuditGateway, WsGateway],
})
export class WsModule {}
