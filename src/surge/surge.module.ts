// src/surge/surge.module.ts
import { Module } from '@nestjs/common';
import { SurgeService } from './surge.service';
import { SurgeProcessor } from './surge.processor';
import { SurgeController } from './surge.controller';
import { SurgeLiveGateway } from '../ws/surge-live.gateway';
import { UtilsModule } from '../utils/utils.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [UtilsModule, ConfigModule],
  providers: [SurgeService, SurgeProcessor, SurgeLiveGateway],
  controllers: [SurgeController],
  exports: [SurgeService, SurgeLiveGateway],
})
export class SurgeModule {}
