// src/geosurge/geo-surge.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeoSurgeService } from './geo-surge.service';
import { GeoSurgeController } from './geo-surge.controller';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';

@Module({
  imports: [ConfigModule],
  providers: [GeoSurgeService, GeoSurgeLiveGateway],
  controllers: [GeoSurgeController],
  exports: [GeoSurgeService, GeoSurgeLiveGateway],
})
export class GeoSurgeModule {}
