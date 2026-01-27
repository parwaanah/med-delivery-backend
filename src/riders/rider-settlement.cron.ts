import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RiderPaymentsService } from './rider-payments.service';

@Injectable()
export class RiderSettlementCron {
  private readonly logger = new Logger(RiderSettlementCron.name);

  constructor(private readonly payments: RiderPaymentsService) {}

  // Every Monday 00:10 (server time) create a batch for the previous week.
  @Cron('10 0 * * 1')
  async weekly() {
    const now = new Date();
    const periodEnd = this.startOfWeek(now);
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      await this.payments.createWeeklyBatch(periodStart, periodEnd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Weekly rider settlement failed: ${msg}`);
    }
  }

  private startOfWeek(d: Date) {
    // Monday 00:00 local time
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay(); // 0=Sun ... 6=Sat
    const diffToMonday = (day + 6) % 7; // 0 if Monday
    date.setDate(date.getDate() - diffToMonday);
    return date;
  }
}

