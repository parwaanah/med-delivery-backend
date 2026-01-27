// src/ws/rider-live.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RiderTelemetryService } from '../riders/rider-telemetry.service';
import { WsAuthService } from './ws-auth.service';
import { getWsCorsOrigin } from '../utils/cors';

const wsCorsOrigin: any = getWsCorsOrigin();

@WebSocketGateway({ cors: { origin: wsCorsOrigin }, namespace: '/rider-live' })
export class RiderLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly telemetry: RiderTelemetryService,
    private readonly wsAuth: WsAuthService,
  ) {}

  async handleConnection(client: Socket) {
    const user = await this.wsAuth.authenticate(client);
    if (!user || String(user.role || '').toUpperCase() !== 'RIDER') {
      client.disconnect(true);
      return;
    }

    (client.data as any).user = user;
    console.log('Rider WS connected:', client.id, 'user=', user.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Rider WS disconnected:', client.id);
  }

  @SubscribeMessage('rider_update')
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      riderId: number;
      lat: number;
      lon: number;
      accuracyM?: number;
      speedMps?: number;
      headingDeg?: number;
      tsMs?: number;
    },
  ) {
    if (!data?.riderId) return;

    // Guard: only allow a rider to send their own updates.
    const user = (client.data as any)?.user;
    const userId = Number(user?.id);
    const role = String(user?.role || '').toUpperCase();
    if (!Number.isFinite(userId) || userId !== Number(data.riderId)) return;
    if (role !== 'RIDER') return;

    await this.telemetry.locationHeartbeat(data.riderId, {
      lat: data.lat,
      lon: data.lon,
      accuracyM: data.accuracyM,
      speedMps: data.speedMps,
      headingDeg: data.headingDeg,
      tsMs: data.tsMs,
    });
  }
}
