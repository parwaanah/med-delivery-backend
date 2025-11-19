// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin.users.controller';
import { AdminAuditController } from './admin.audit.controller';
import { AdminMetricsController } from './admin.metrics.controller';
import { AdminOrdersController } from './admin.orders.controller';
import { AdminQueueController } from './admin.queue.controller';
import { AdminEscalationController } from './admin-escalation.controller';

import { EscalationService } from './escalation.service';

// IMPORT MODULES (not individual services)
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { SurgeModule } from '../surge/surge.module';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';

// WebSocket module
import { WsModule } from '../ws/ws.module';

// Utils
import { NotificationService } from '../utils/notification.service';

@Module({
  imports: [
    WsModule,         // WebSocket Gateway + WS services
    OrdersModule,     // Provides OrdersService (needed by Admin)
    PaymentsModule,   // Provides PaymentsService
    SurgeModule,      // Provides SurgeService
    GeoSurgeModule,   // Provides GeoSurgeService
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
