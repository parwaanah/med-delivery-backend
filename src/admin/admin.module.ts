import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin.users.controller';
import { AdminAuditController } from './admin.audit.controller';
import { AdminMetricsController } from './admin.metrics.controller';
import { AdminOrdersController } from './admin.orders.controller';
import { AdminQueueController } from './admin.queue.controller';
import { AdminEscalationController } from './admin-escalation.controller';
import { AdminReportsController } from './admin.reports.controller';
import { AdminNotificationsController } from './admin.notifications.controller';
import { AdminMetricsService } from './admin.metrics.service';
import { AdminMetricsListener } from './admin.metrics.listener';
import { EscalationService } from './escalation.service';

import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { WsModule } from '../ws/ws.module';
import { ReportsModule } from '../reports/reports.module';
import { NotificationService } from '../utils/notification.service';

@Module({
  imports: [
    WsModule,
    ReportsModule,
    forwardRef(() => OrdersModule),
    PaymentsModule,
    SurgeModule,
    GeoSurgeModule,
  ],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminAuditController,
    AdminMetricsController,
    AdminOrdersController,
    AdminQueueController,
    AdminEscalationController,
    AdminReportsController,
    AdminNotificationsController,
  ],
  providers: [
    PrismaService,
    EscalationService,
    AdminMetricsService,
    AdminMetricsListener,
    NotificationService,
  ],
  exports: [
    EscalationService, // ✅ IMPORTANT
  ],
})
export class AdminModule {}
