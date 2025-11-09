// src/ws/rider-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/rider-live',
})
export class RiderLiveGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RiderLiveGateway.name);

  // ✅ Generic broadcast to all clients (dashboards, maps, etc.)
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.log(`📡 Broadcast event: ${event}`, JSON.stringify(data));
  }

  // ✅ Specific admin broadcast (matches notifyAdmins pattern used elsewhere)
  notifyAdmins(event: string, data: any) {
    this.server.to('admin').emit(event, data);
    this.logger.log(`🧭 Sent admin notification → ${event}`, JSON.stringify(data));
  }

  // ✅ Direct rider update listener (optional)
  @SubscribeMessage('rider_update')
  handleRiderUpdate(@MessageBody() payload: any) {
    this.logger.log(`📍 Rider update received`, JSON.stringify(payload));
    this.broadcast('rider_update', payload);
  }
}
