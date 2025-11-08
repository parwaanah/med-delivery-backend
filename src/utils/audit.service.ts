// src/utils/audit.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditLiveGateway } from '../ws/audit-live.gateway';
import { NotificationService } from './notification.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveGateway: AuditLiveGateway,
    private readonly notification: NotificationService,
  ) {}

  async log({
    userId,
    email,
    ip,
    userAgent,
    eventType,
    role,
    success = true,
  }: {
    userId?: number;
    email?: string;
    ip?: string;
    userAgent?: string;
    eventType: string;
    role?: string;
    success?: boolean;
  }) {
    try {
      const record = await this.prisma.loginAudit.create({
        data: { userId, email, ip, userAgent, eventType, role, success },
      });

      // Broadcast audit feed live
      this.liveGateway.emitAuditEvent({
        eventType,
        userId,
        email,
        role,
        success,
        timestamp: record.timestamp,
      });

      // Admin toast for key audit events
      const toastType = success ? 'ok' : 'err';
      this.notification.sendAdminToast({
        type: toastType,
        title: `Audit • ${eventType}`,
        text: `${email ?? 'unknown'} (${role ?? 'N/A'})`,
      });

      return record;
    } catch (err) {
      this.logger.error('Audit log failed', err);
      // Prevent crash if audit DB fails — optional: silent continue
      return { error: true, message: 'Audit log failed' };
    }
  }
}
