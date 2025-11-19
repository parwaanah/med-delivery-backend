// src/riders/riders.module.ts
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
    forwardRef(() => WsModule),    // WsModule <-> RidersModule circular dependency
    GeoSurgeModule,
    SurgeModule,
  ],
  controllers: [RidersController],
  providers: [
    RidersService,
    PrismaService,
    NotificationService,
  ],
  exports: [RidersService], // <-- make RidersService available to WsModule
})
export class RidersModule {}
