// src/riders/riders.module.ts
import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { PrismaService } from '../utils/prisma.service';
import { UtilsModule } from '../utils/utils.module';
import { SurgeModule } from '../surge/surge.module'; // ✅ add this line

@Module({
  imports: [UtilsModule, SurgeModule], // ✅ add SurgeModule here
  controllers: [RidersController],
  providers: [RidersService, PrismaService],
})
export class RidersModule {}
