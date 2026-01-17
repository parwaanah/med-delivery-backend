import { Module, forwardRef } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';

import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';

import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { SurgeModule } from '../surge/surge.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [
    forwardRef(() => WsModule),   // circular dependency handled correctly
    GeoSurgeModule,
    SurgeModule,
  ],
  controllers: [
    RidersController,            // ✅ ONLY rider operational endpoints
  ],
  providers: [
    RidersService,
    PrismaService,
    NotificationService,
  ],
  exports: [
    RidersService,               // used by WsModule
  ],
})
export class RidersModule {}
