// src/ws/rider-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@WebSocketGateway({
  namespace: '/rider-live',
  cors: { origin: '*' },
})
export class RiderLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RiderLiveGateway.name);

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`🟢 RiderLive connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 RiderLive disconnected: ${client.id}`);
  }

  // ✅ Notify admins (used by RidersService)
  notifyAdmins(event: string, payload: any) {
    try {
      this.server.emit(event, payload);
    } catch (err) {
      this.logger.warn('notifyAdmins failed', err);
    }
  }

  // ✅ Optional direct broadcast (if used for clients)
  broadcastRiderLocation(payload: {
    id: number;
    lat: number;
    lon: number;
    status: string;
    timestamp: number;
  }) {
    this.server.emit('rider_location', payload);
  }
}
