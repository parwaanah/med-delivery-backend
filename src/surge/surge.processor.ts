// src/surge/surge.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { SurgeService } from './surge.service';

@Injectable()
export class SurgeProcessor {
  private readonly logger = new Logger('SurgeProcessor');
  private interval!: NodeJS.Timeout; // ✅ definite assignment

  constructor(private readonly surge: SurgeService) {}

  onModuleInit() {
    this.logger.log('🚀 SurgeProcessor running every 15s');
    this.interval = setInterval(() => this.tick(), 15000);
  }

  async tick() {
    try {
      await (this.surge as any)['recalculate']();
    } catch (err) {
      this.logger.error('Surge recalc error', err);
    }
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }
}
