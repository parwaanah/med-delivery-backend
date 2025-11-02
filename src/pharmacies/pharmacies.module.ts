import { Module } from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { PharmaciesController } from './pharmacies.controller';
import { PrismaService } from '../utils/prisma.service';

@Module({
  controllers: [PharmaciesController],
  providers: [PharmaciesService, PrismaService],
})
export class PharmaciesModule {}
