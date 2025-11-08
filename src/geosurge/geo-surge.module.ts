// src/geosurge/geo-surge.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../utils/prisma.service';
import { GeoSurgeService } from './geo-surge.service';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';

@Module({
  imports: [],
  providers: [ConfigService, PrismaService, GeoSurgeService, GeoSurgeLiveGateway],
  exports: [GeoSurgeService],
})
export class GeoSurgeModule {}
