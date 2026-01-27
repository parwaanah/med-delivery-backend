// src/ws/chat-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { WsAuthService } from './ws-auth.service';
import { getWsCorsOrigin } from '../utils/cors';

const wsCorsOrigin: any = getWsCorsOrigin();

@WebSocketGateway({
  cors: { origin: wsCorsOrigin },
  namespace: '/chat-live',
})
export class ChatLiveGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatLiveGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly wsAuth: WsAuthService,
  ) {}

  async handleConnection(client: Socket) {
    const user = await this.wsAuth.authenticate(client);
    if (!user) {
      client.disconnect(true);
      return;
    }

    (client.data as any).user = user;
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() msg: { from?: number; to: number; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = (client.data as any)?.user;
    const from = Number(user?.id);
    if (!Number.isFinite(from)) return;

    const to = Number(msg?.to);
    const text = String(msg?.text || '').trim();
    if (!Number.isFinite(to) || !text) return;

    this.logger.log(`chat ${from} -> ${to}: ${text}`);
    await this.chatService.saveMessage(from, to, text);
    this.server.emit(`chat:${to}`, { from, to, text });
  }
}
