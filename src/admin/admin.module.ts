import { Module } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin.users.controller';
import { AdminAuditController } from './admin.audit.controller';
import { AdminMetricsController } from './admin.metrics.controller';
import { AdminQueueController } from './admin.queue.controller';

@Module({
  controllers: [
    AdminController,
    AdminUsersController,
    AdminAuditController,
    AdminMetricsController,
    AdminQueueController,
  ],
  providers: [PrismaService],
})
export class AdminModule {}
