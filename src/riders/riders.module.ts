// src/riders/riders.module.ts
import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { PrismaService } from '../utils/prisma.service';
import { GeoSurgeModule } from '../geosurge/geo-surge.module'; // ✅ import

@Module({
  imports: [GeoSurgeModule], // ✅ now Nest can inject GeoSurgeService
  controllers: [RidersController],
  providers: [RidersService, PrismaService],
  exports: [RidersService],
})
export class RidersModule {}
