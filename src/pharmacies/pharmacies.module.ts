import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';

@Module({
  providers: [PharmaciesService],
  controllers: [PharmaciesController]
})
export class PharmaciesModule {}
