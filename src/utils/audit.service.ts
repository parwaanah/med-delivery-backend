// src/utils/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditLiveGateway } from '../ws/audit-live.gateway';
import { NotificationService } from './notification.service';

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private liveGateway: AuditLiveGateway,
    private notification: NotificationService,
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
    const record = await this.prisma.loginAudit.create({
      data: { userId, email, ip, userAgent, eventType, role, success },
    });

    // 🔔 broadcast audit feed live
    this.liveGateway.emitAuditEvent({
      type: eventType,
      userId,
      email,
      role,
      success,
      timestamp: record.timestamp,
    });

    // 🧩 send admin toast
    this.notification.sendAdminToast({
      type: success ? 'ok' : 'err',
      title: `Audit • ${eventType}`,
      text: `${email ?? 'unknown'} (${role ?? 'N/A'})`,
    });

    return record;
  }
}
