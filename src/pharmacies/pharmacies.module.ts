// src/pharmacies/pharmacies.module.ts
import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { UtilsModule } from '../utils/utils.module';
import { SurgeModule } from '../surge/surge.module';

@Module({
  imports: [UtilsModule, SurgeModule],
  controllers: [PharmaciesController],
  providers: [PharmaciesService, PharmacyInventoryService],
  exports: [PharmaciesService, PharmacyInventoryService],
})
export class PharmaciesModule {}
