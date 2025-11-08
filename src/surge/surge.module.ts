// src/surge/surge.module.ts
import { Module } from '@nestjs/common';
import { SurgeService } from './surge.service';
import { SurgeProcessor } from './surge.processor';
import { SurgeController } from './surge.controller';
import { WsModule } from '../ws/ws.module';
import { UtilsModule } from '../utils/utils.module';

@Module({
  imports: [WsModule, UtilsModule],
  providers: [SurgeService, SurgeProcessor],
  controllers: [SurgeController],
  exports: [SurgeService],
})
export class SurgeModule {}
