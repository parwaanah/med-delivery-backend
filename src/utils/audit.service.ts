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
    private readonly live: AuditLiveGateway,
    private readonly notify: NotificationService,
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

      this.live.emitAuditEvent({
        eventType,
        userId,
        email,
        role,
        success,
        timestamp: record.timestamp,
      });

      this.notify.sendAdminToast({
        type: success ? 'ok' : 'err',
        title: `Audit • ${eventType}`,
        text: email ?? 'unknown',
      });

      return record;
    } catch (err) {
      this.logger.error('Audit log failed', err);
      return { error: true };
    }
  }
}
