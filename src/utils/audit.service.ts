import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WsGateway } from '../ws/ws.gateway';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsGateway,
  ) {}

  async log(params: {
    userId?: number;
    email?: string;
    role?: string;
    eventType: string;
    success: boolean;
    ip?: string;
    userAgent?: string;
    meta?: any;
  }) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.eventType,
          resource: 'AUTH',
          meta: {
            email: params.email,
            role: params.role,
            success: params.success,
            ip: params.ip,
            userAgent: params.userAgent,
            ...(params.meta || {}),
          },
        },
      });
    } catch (err) {
      this.logger.error('Audit log failed', err);
      return null;
    }
  }

  // ✅ USED FOR REFUNDS + ADMIN ACTIONS
  async logAdminAction(params: {
    userId?: number;
    action: string;
    resource?: string;
    meta?: any;
  }) {
    try {
      const record = await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resource: params.resource,
          meta: params.meta,
        },
      });

      this.ws.notifyAdmins('admin_audit_event', {
        id: record.id,
        action: record.action,
        resource: record.resource,
        meta: record.meta,
        at: record.createdAt,
        userId: record.userId,
      });

      return record;
    } catch (err) {
      this.logger.error('Admin audit failed', err);
      return null;
    }
  }
}
