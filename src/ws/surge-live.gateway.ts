// src/ws/surge-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface SurgeBroadcast {
  multiplier: number;
  demand: number;
  supply: number;
  timestamp: number;
  override?: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/surge-live',
})
export class SurgeLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SurgeLiveGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`🟢 Surge client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Surge client disconnected: ${client.id}`);
  }

  /** Broadcast surge data with full timestamp + override info */
  broadcastSurge(data: SurgeBroadcast) {
    if (!this.server) return;
    this.server.emit('surge_update', data);
    this.logger.debug(
      `📡 Surge broadcast → x${data.multiplier} | D=${data.demand} | S=${data.supply} | T=${data.timestamp}`,
    );
  }
}
