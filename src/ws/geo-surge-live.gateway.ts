// src/ws/geo-surge-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { getWsCorsOrigin } from '../utils/cors';

const wsCorsOrigin: any = getWsCorsOrigin();

@WebSocketGateway({
  namespace: '/geo-surge-live',
  cors: { origin: wsCorsOrigin },
})
export class GeoSurgeLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger('GeoSurgeLiveGateway');

  handleConnection(client: any) {
    this.logger.log(`🌐 GeoSurge client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`❌ GeoSurge client disconnected: ${client.id}`);
  }

  broadcastGeo(zones: any[]) {
    this.server.emit('geo_update', { zones });
  }
}
