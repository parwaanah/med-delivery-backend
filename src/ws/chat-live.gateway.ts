// src/ws/chat-live.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat-live',
})
export class ChatLiveGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatLiveGateway.name);

  constructor(private chatService: ChatService) {}

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() msg: { from: number; to: number; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`💬 ${msg.from} → ${msg.to}: ${msg.text}`);
    await this.chatService.saveMessage(msg.from, msg.to, msg.text);
    this.server.emit(`chat:${msg.to}`, msg);
  }
}
