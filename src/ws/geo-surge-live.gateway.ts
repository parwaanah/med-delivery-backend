// src/ws/geo-surge-live.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common'; // ✅ Logger correctly imported from @nestjs/common

@WebSocketGateway({ namespace: '/geo-surge-live', cors: { origin: '*' } })
@Injectable()
export class GeoSurgeLiveGateway {
  private readonly logger = new Logger('GeoSurgeLiveGateway');

  @WebSocketServer()
  server!: Server;

  broadcastGeo(zones: any[]) {
    try {
      this.server.emit('geo_update', { zones, ts: Date.now() });
      this.logger.debug(`🌍 broadcast geo_update -> ${zones.length} zones`);
    } catch (err: any) {
      this.logger.error('broadcastGeo failed', err.message || err);
    }
  }
}
