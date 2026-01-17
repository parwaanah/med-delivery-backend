import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AdminMetricsService } from './admin.metrics.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class AdminMetricsListener {
  private readonly logger = new Logger(AdminMetricsListener.name);

  constructor(
    private readonly metrics: AdminMetricsService,
    private readonly ws: WsGateway,
  ) {}

  /**
   * 🔁 Push live admin metrics every 10 seconds
   * This feeds the Admin Dashboard in real time
   */
  @Interval(10_000)
  async pushLiveMetrics() {
    try {
      const data = await this.metrics.getMetrics();

      // Broadcast only to connected admins
      this.ws.notifyAdmins('admin_metrics', data);

      this.logger.debug('Admin metrics pushed');
    } catch (err: any) {
      this.logger.warn(
        'Failed to push admin metrics',
        err?.message ?? err,
      );
    }
  }
}
