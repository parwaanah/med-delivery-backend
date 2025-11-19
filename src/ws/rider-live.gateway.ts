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
import { RidersService } from '../riders/riders.service';

@WebSocketGateway({ cors: true })
export class RiderLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private riders: RidersService) {}

  handleConnection(client: Socket) {
    console.log('Rider WS connected:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Rider WS disconnected:', client.id);
  }

  @SubscribeMessage('rider_update')
  async updateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { riderId: number; lat: number; lon: number },
  ) {
    if (!data?.riderId) return;

    await this.riders.updateLocationWS(
      data.riderId,
      data.lat,
      data.lon,
    );
  }
}
