import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditService } from './audit/audit.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuditController } from './audit/audit.controller';
import { PrismaService } from '../../prisma/prisma.service'; // ✅ Added import

@Module({
  controllers: [AdminController, AnalyticsController, AuditController],
  providers: [
    AdminService,
    AnalyticsService,
    AuditService,
    PrismaService, // ✅ Added PrismaService so AuditService can inject it
  ],
  exports: [AuditService], // ✅ Allow OrdersModule to use AuditService
})
export class AdminModule {}
