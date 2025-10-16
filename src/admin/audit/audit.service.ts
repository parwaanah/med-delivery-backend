import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestContext } from '../../common/context/request-context'; // ✅ Context for reqId, user, etc.

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🧾 Record an audit log entry with full context (reqId, user, role)
   */
  async record(
    actorId: number | null,
    actorRole: 'admin' | 'pharmacy' | 'rider' | 'customer' | 'system',
    action: string,
    targetType: string,
    targetId?: number,
    extra?: Record<string, any>, // ✅ optional metadata
  ) {
    try {
      // 🧠 Pull request context
      const reqId = RequestContext.getRequestId();
      const { id: userId, role: userRole } = RequestContext.getUser();

      // 🗂️ Combine metadata
      const meta = {
        ...extra,
        requestId: reqId,
        triggeredBy: { userId, userRole },
        timestamp: new Date().toISOString(),
      };

      // 💾 Store in DB
      await this.prisma.auditLog.create({
        data: {
          actorId,
          actorRole,
          action,
          targetType,
          targetId: targetId ?? null,
          createdAt: new Date(),
          details: meta, // ✅ JSON column
        },
      });

      // 🧾 Log in console
      this.logger.log(
        `[reqId:${reqId}] [${actorRole}] ${action} → ${targetType} (${targetId || '-'}) by ${userRole}#${userId}`,
      );
    } catch (err) {
      this.logger.error(`❌ Audit Log Error: ${err.message}`, err.stack);
    }
  }

  /**
   * 📜 Get all logs
   */
  async getAllLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 🔍 Filter logs dynamically
   */
  async filterLogs(
    role?: string,
    targetType?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const where: Record<string, any> = {};

    if (role) where.actorRole = role;
    if (targetType) where.targetType = targetType;
    if (fromDate || toDate) {
      where.createdAt = {
        gte: fromDate ? new Date(fromDate) : undefined,
        lte: toDate ? new Date(toDate) : undefined,
      };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!logs.length) throw new BadRequestException('No matching logs found');
    return logs;
  }
}
