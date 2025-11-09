// src/reports/reports.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportsCron {
  private readonly logger = new Logger(ReportsCron.name);
  constructor(private readonly reports: ReportsService) {}

  @Cron('0 0 * * *') // every midnight
  async handleDailyReport() {
    await this.reports.generateDailyReport();
    this.logger.log('✅ Daily report task executed');
  }
}
