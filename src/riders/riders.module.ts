// src/riders/riders.module.ts
import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { RiderLiveGateway } from '../ws/rider-live.gateway';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [UtilsModule, GeoSurgeModule],
  controllers: [RidersController],
  providers: [RidersService, RiderLiveGateway],
  exports: [RidersService],
})
export class RidersModule {}
