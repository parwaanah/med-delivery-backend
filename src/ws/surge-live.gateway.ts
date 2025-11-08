// src/ws/surge-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/surge-live',
})
export class SurgeLiveGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server; // ✅ definite assignment
  private readonly logger = new Logger('SurgeLiveGateway');

  afterInit() {
    this.logger.log('⚡ SurgeLiveGateway ready');
  }

  broadcastSurge(data: any) {
    this.server.emit('surge_update', data);
  }
}
