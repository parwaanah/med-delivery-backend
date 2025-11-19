// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { PrismaService } from '../utils/prisma.service';

@Module({
  controllers: [NotificationsController],
  providers: [PrismaService],
})
export class NotificationsModule {}
