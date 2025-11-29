// src/pharmacies/pharmacies.module.ts
import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';
import { PrismaService } from '../utils/prisma.service';

// 🚀 IMPORTANT: import GeoSurgeModule to inject GeoSurgeService
import { GeoSurgeModule } from '../geosurge/geo-surge.module';

@Module({
  imports: [
    GeoSurgeModule, // <-- FIX: provides GeoSurgeService to this module
  ],
  controllers: [PharmaciesController],
  providers: [PharmaciesService, PrismaService],
  exports: [PharmaciesService],
})
export class PharmaciesModule {}
