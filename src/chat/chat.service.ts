// src/chat/chat.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async saveMessage(senderId: number, receiverId: number, text: string) {
    const msg = await this.prisma.chatMessage.create({
      data: { senderId, receiverId, text },
    });
    this.logger.log(`💬 Chat message stored: ${msg.id}`);
    return msg;
  }

  async getMessagesBetweenUsers(a: number, b: number) {
    return this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: a, receiverId: b },
          { senderId: b, receiverId: a },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
