// src/surge/surge.module.ts
import { Module } from '@nestjs/common';
import { SurgeService } from './surge.service';
import { SurgeLiveGateway } from '../ws/surge-live.gateway';
import { PrismaService } from '../utils/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { SurgeController } from './surge.controller';


@Module({
  imports: [ConfigModule],
  providers: [SurgeService, SurgeLiveGateway, PrismaService],
  controllers: [SurgeController],
  exports: [SurgeService, SurgeLiveGateway],
})
export class SurgeModule {}
