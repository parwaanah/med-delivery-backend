import { Module } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAuditController } from './admin.audit.controller';

@Module({
  controllers: [AdminController, AdminAuditController, AdminAuditController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}
