import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AdminAuditGateway } from '../ws/admin.audit.gateway';

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private auditGateway: AdminAuditGateway,
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
    // 1️⃣ Save audit log to DB
    const record = await this.prisma.loginAudit.create({
      data: { userId, email, ip, userAgent, eventType, role, success },
    });

    // 2️⃣ Emit live event to connected admin clients
    try {
      this.auditGateway.server?.emit('audit_event', {
        event: 'LOGIN_AUDIT',
        data: record,
      });
      console.log('📡 Audit event emitted:', eventType);
    } catch (err) {
      console.warn('⚠️ Audit broadcast failed:', err);
    }

    return record;
  }
}
