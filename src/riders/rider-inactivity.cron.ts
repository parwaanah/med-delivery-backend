import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../utils/audit.service';
import { RiderShiftService } from './rider-shift.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class RiderInactivityCron {
  private readonly logger = new Logger(RiderInactivityCron.name);

  constructor(
    private readonly config: ConfigService,
    private readonly shifts: RiderShiftService,
    private readonly audit: AuditService,
    private readonly ws: WsGateway,
  ) {}

  private inactivityMinutes() {
    const raw =
      this.config.get<string>('RIDER_INACTIVITY_MINUTES') ??
      process.env.RIDER_INACTIVITY_MINUTES ??
      '15';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 15;
    return Math.min(Math.max(Math.floor(n), 3), 240);
  }

  @Cron('*/1 * * * *') // every minute
  async handleTimeouts() {
    if (process.env.DISABLE_RIDER_TIMEOUT === '1') return;

    const minutes = this.inactivityMinutes();
    const cutoffMs = Date.now() - minutes * 60_000;

    const ids = await this.shifts.getOnlineRiders();
    if (!ids.length) return;

    let timedOut = 0;
    for (const s of ids) {
      const riderId = Number(s);
      if (!Number.isFinite(riderId)) continue;

      try {
        const hb = await this.shifts.getLastHeartbeatMs(riderId);
        if (hb != null && hb >= cutoffMs) continue;

        await this.shifts.autoTimeout(riderId, minutes);

        await this.audit.logAdminAction({
          userId: riderId,
          action: 'RIDER_AUTO_TIMEOUT',
          resource: `rider:${riderId}`,
          meta: { minutes },
        });

        this.ws.notifyUser(riderId, 'rider.availability', {
          state: 'OFFLINE',
          reason: 'INACTIVITY_TIMEOUT',
          minutes,
        });

        timedOut += 1;
      } catch (e: any) {
        this.logger.warn(
          `Timeout check failed for rider ${s}: ${e?.message || e}`,
        );
      }
    }

    if (timedOut > 0) {
      this.logger.debug(`Auto-timed out riders: ${timedOut}`);
    }
  }
}

