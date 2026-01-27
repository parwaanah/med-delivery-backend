import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

function daysToDate(days: number) {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

function parseRetentionDays(value: string | undefined): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

@Injectable()
export class DataRetentionService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run() {
    const notificationDays = parseRetentionDays(
      process.env.RETENTION_NOTIFICATIONS_DAYS,
    );
    const loginAuditDays = parseRetentionDays(
      process.env.RETENTION_LOGIN_AUDIT_DAYS,
    );
    const chatDays = parseRetentionDays(process.env.RETENTION_CHAT_DAYS);
    const supportDays = parseRetentionDays(process.env.RETENTION_SUPPORT_DAYS);
    const auditDays = parseRetentionDays(process.env.RETENTION_AUDIT_LOG_DAYS);
    const sessionDays = parseRetentionDays(process.env.RETENTION_SESSION_DAYS);
    const otpDays = parseRetentionDays(process.env.RETENTION_OTP_DAYS);

    const tasks: Promise<any>[] = [];

    if (notificationDays) {
      tasks.push(
        this.prisma.notification.deleteMany({
          where: { createdAt: { lt: daysToDate(notificationDays) } },
        }),
      );
    }

    if (loginAuditDays) {
      tasks.push(
        this.prisma.loginAudit.deleteMany({
          where: { timestamp: { lt: daysToDate(loginAuditDays) } },
        }),
      );
    }

    if (chatDays) {
      tasks.push(
        this.prisma.chatMessage.deleteMany({
          where: { createdAt: { lt: daysToDate(chatDays) } },
        }),
      );
    }

    if (supportDays) {
      tasks.push(
        this.prisma.supportMessage.deleteMany({
          where: { createdAt: { lt: daysToDate(supportDays) } },
        }),
      );
      tasks.push(
        this.prisma.supportTicket.deleteMany({
          where: { createdAt: { lt: daysToDate(supportDays) } },
        }),
      );
    }

    if (auditDays) {
      tasks.push(
        this.prisma.auditLog.deleteMany({
          where: { createdAt: { lt: daysToDate(auditDays) } },
        }),
      );
    }

    if (sessionDays) {
      tasks.push(
        this.prisma.session.deleteMany({
          where: { createdAt: { lt: daysToDate(sessionDays) } },
        }),
      );
      tasks.push(
        this.prisma.refreshToken.deleteMany({
          where: { createdAt: { lt: daysToDate(sessionDays) } },
        }),
      );
    }

    if (otpDays) {
      tasks.push(
        this.prisma.otpRequest.deleteMany({
          where: { createdAt: { lt: daysToDate(otpDays) } },
        }),
      );
    }

    if (tasks.length) {
      await Promise.all(tasks);
    }
  }
}
