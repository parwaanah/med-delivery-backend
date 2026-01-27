import { Module, forwardRef } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { RiderControlController } from './rider-control.controller';
import { RiderEarningsController } from './rider-earnings.controller';
import { RiderQualityController } from './rider-quality.controller';
import { RiderShiftService } from './rider-shift.service';
import { RiderInactivityCron } from './rider-inactivity.cron';
import { RiderTelemetryService } from './rider-telemetry.service';
import { RiderPaymentsService } from './rider-payments.service';
import { RiderSettlementCron } from './rider-settlement.cron';
import { RiderLedgerReconcileCron } from './rider-ledger-reconcile.cron';
import { RiderQualityService } from './rider-quality.service';

import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';

import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { SurgeModule } from '../surge/surge.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [
    forwardRef(() => WsModule), // circular dependency handled correctly
    GeoSurgeModule,
    SurgeModule,
  ],
  controllers: [
    RidersController,
    RiderControlController,
    RiderEarningsController,
    RiderQualityController,
  ],
  providers: [
    RidersService,
    RiderShiftService,
    RiderInactivityCron,
    RiderTelemetryService,
    RiderPaymentsService,
    RiderSettlementCron,
    RiderLedgerReconcileCron,
    RiderQualityService,
    PrismaService,
    NotificationService,
  ],
  exports: [
    RidersService,
    RiderTelemetryService,
    RiderPaymentsService,
    RiderQualityService,
  ], // used by WsModule/Orders/Admin
})
export class RidersModule {}
