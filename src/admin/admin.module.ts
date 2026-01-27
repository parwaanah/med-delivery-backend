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
import { AdminPharmaciesController } from './admin.pharmacies.controller';
import { AdminPharmacySettlementsController } from './admin.pharmacy-settlements.controller';
import { AdminRiderSettlementsController } from './admin.rider-settlements.controller';
import { AdminRiderQualityController } from './admin.riders.quality.controller';
import { AdminOpsController } from './admin.ops.controller';
import { AdminPermissionsController } from './admin.permissions.controller';
import { AdminImpersonationController } from './admin.impersonation.controller';
import { AdminSlaController } from './admin.sla.controller';
import { AdminIncidentsController } from './admin.incidents.controller';
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
import { RidersModule } from '../riders/riders.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    WsModule,
    ReportsModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => RidersModule),
    PaymentsModule,
    SurgeModule,
    GeoSurgeModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminAuditController,
    AdminMetricsController,
    AdminOrdersController,
    AdminOpsController,
    AdminQueueController,
    AdminEscalationController,
    AdminReportsController,
    AdminNotificationsController,
    AdminPharmaciesController,
    AdminPharmacySettlementsController,
    AdminRiderSettlementsController,
    AdminRiderQualityController,
    AdminPermissionsController,
    AdminImpersonationController,
    AdminSlaController,
    AdminIncidentsController,
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
