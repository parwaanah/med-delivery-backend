// src/geosurge/geo-surge.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/geo-surge-live', cors: true })
export class GeoSurgeLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server; // ✅ definite assignment

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
