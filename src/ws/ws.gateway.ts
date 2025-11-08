// src/ws/ws.gateway.ts
import { Module, Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../utils/prisma.service';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(WsGateway.name);

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Socket connected: ${client.id}`);
    // If clients pass token, you may authenticate here (optional)
    // Listen for join-room message to join a user-specific room
    client.on('join', (payload: { userId: number }) => {
      try {
        const uid = payload?.userId;
        if (!uid) return;
        client.join(`user-${uid}`);
        this.logger.log(`Socket ${client.id} joined room user-${uid}`);
      } catch (err) {
        this.logger.warn('join handler error', err as any);
      }
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    // socket.io automatically leaves rooms on disconnect, so nothing else needed
  }

  /**
   * Notify a specific user (all sockets in room user-<id>)
   */
  notifyUser(userId: number, event: string, payload: any) {
    try {
      if (!this.server) return;
      this.server.to(`user-${userId}`).emit(event, payload);
    } catch (err) {
      this.logger.warn(`Failed to notify user ${userId}`, err as any);
    }
  }

  /**
   * Broadcast to everyone
   */
  broadcast(event: string, payload: any) {
    try {
      if (!this.server) return;
      this.server.emit(event, payload);
    } catch (err) {
      this.logger.warn('Broadcast failed', err as any);
    }
  }
}

/**
 * Provide a small module wrapper for easy import
 */
@Module({
  providers: [PrismaService, WsGateway],
  exports: [WsGateway],
})
export class WsModule {}
