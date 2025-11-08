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

/**
 * RiderLiveGateway
 * - Receives rider location updates: "location_update" { riderId, lat, lng, heading, speed }
 * - Broadcasts rider locations to interested rooms:
 *    - "rider-{id}" personal room
 *    - "admin" room for admins
 *    - optionally "nearby-pharmacy-{pharmacyId}" when implemented
 */
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

    // allow client to join rooms: { joinRoom: { name: 'rider-123' } }
    client.on('joinRoom', (payload: { room: string }) => {
      if (payload?.room) {
        client.join(payload.room);
        this.logger.debug(`Client ${client.id} joined room ${payload.room}`);
      }
    });

    client.on('location_update', async (payload: { riderId: number; lat: number; lng: number; heading?: number; speed?: number }) => {
      try {
        if (!payload?.riderId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;

        const update = {
          riderId: payload.riderId,
          lat: payload.lat,
          lng: payload.lng,
          heading: payload.heading ?? null,
          speed: payload.speed ?? null,
          at: new Date().toISOString(),
        };

        // save last known rider location non-blocking (best-effort)
        this.prisma.user.update({
          where: { id: payload.riderId },
          data: { latitude: payload.lat, longitude: payload.lng },
        }).catch((e) => this.logger.warn('Failed to persist rider location', e));

        // personal room
        this.server.to(`rider-${payload.riderId}`).emit('location', update);

        // broadcast to admins
        this.server.to('admin').emit('rider_location', update);

        // emit a lightweight public feed (limit rate on client)
        this.server.emit('rider_feed', { riderId: payload.riderId, lat: payload.lat, lng: payload.lng });

      } catch (err) {
        this.logger.error('location_update handler failed', err as any);
      }
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 RiderLive disconnected: ${client.id}`);
  }

  /**
   * Utility: send location to a single rider (server-initiated)
   */
  notifyRiderLocation(riderId: number, payload: any) {
    try {
      this.server.to(`rider-${riderId}`).emit('location', payload);
    } catch (err) {
      this.logger.warn('notifyRiderLocation failed', err);
    }
  }

  /**
   * Utility: notify admins
   */
  notifyAdmins(event: string, payload: any) {
    try {
      this.server.to('admin').emit(event, payload);
    } catch (err) {
      this.logger.warn('notifyAdmins failed', err);
    }
  }
}
