// src/geosurge/geo-surge.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { GeoSurgeService } from './geo-surge.service';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';
import { GeoSurgeController } from './geo-surge.controller';

@Module({
  controllers: [GeoSurgeController],
  providers: [ConfigService, PrismaService, GeoSurgeService, GeoSurgeLiveGateway],
  exports: [GeoSurgeService], // ✅ export so other modules (like RidersModule) can inject it
})
export class GeoSurgeModule {}
