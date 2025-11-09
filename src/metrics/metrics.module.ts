import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import * as client from 'prom-client';

// collect defaults on module load
client.collectDefaultMetrics();

@Module({
  controllers: [MetricsController],
})
export class MetricsModule {}
