// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../utils/prisma.service';

@Module({
  providers: [ChatService, PrismaService],
  exports: [ChatService],
})
export class ChatModule {}
