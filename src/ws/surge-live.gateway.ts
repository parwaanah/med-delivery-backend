// src/ws/surge-live.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { getWsCorsOrigin } from '../utils/cors';

const wsCorsOrigin: any = getWsCorsOrigin();

@WebSocketGateway({ namespace: '/surge-live', cors: { origin: wsCorsOrigin } })
export class SurgeLiveGateway {
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(SurgeLiveGateway.name);

  broadcastSurge(payload: any) {
    try {
      this.server.emit('surge_update', payload);
      this.logger.debug('surge_update emitted', JSON.stringify(payload));
    } catch (err) {
      this.logger.warn('surge broadcast failed', err);
    }
  }
}
