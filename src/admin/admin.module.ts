// src/admin/admin.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin.users.controller';
import { AdminAuditController } from './admin.audit.controller';
import { AdminMetricsController } from './admin.metrics.controller';
import { AdminOrdersController } from './admin.orders.controller';
import { AdminQueueController } from './admin.queue.controller';
import { AdminEscalationController } from './admin-escalation.controller';

import { EscalationService } from './escalation.service';

import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { WsModule } from '../ws/ws.module';

import { NotificationService } from '../utils/notification.service';

@Module({
  imports: [
    WsModule,

    // ❗ Critical fix: break circular deps
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
  ],

  providers: [
    PrismaService,
    EscalationService,
    NotificationService,
  ],

  exports: [EscalationService],
})
export class AdminModule {}
