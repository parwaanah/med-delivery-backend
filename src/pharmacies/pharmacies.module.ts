// src/pharmacies/pharmacies.module.ts
import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';
import { PrismaService } from '../utils/prisma.service';
import {
  PharmaciesInventoryController,
  PharmacyInventoryController,
} from './pharmacy-inventory.controller';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { PharmacyEarningsController } from './pharmacy-earnings.controller';

// dYs? IMPORTANT: import GeoSurgeModule to inject GeoSurgeService
import { GeoSurgeModule } from '../geosurge/geo-surge.module';
import { SurgeModule } from '../surge/surge.module';

@Module({
  imports: [
    GeoSurgeModule, // <-- FIX: provides GeoSurgeService to this module
    SurgeModule,
  ],
  controllers: [
    PharmaciesController,
    PharmaciesInventoryController,
    PharmacyInventoryController,
    PharmacyEarningsController,
  ],
  providers: [
    PharmaciesService,
    PharmacyInventoryService,
    PrismaService,
  ],
  exports: [PharmaciesService],
})
export class PharmaciesModule {}
