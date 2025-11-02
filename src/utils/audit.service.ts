import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

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
    await this.prisma.loginAudit.create({
      data: { userId, email, ip, userAgent, eventType, role, success },
    });
  }
}
