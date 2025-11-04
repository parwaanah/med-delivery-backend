// src/admin/admin.audit.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAuditController {
  constructor(private prisma: PrismaService) {}

  /**
   * Fetch paginated, filterable audit logs
   * Example: /admin/audit/logs?page=1&limit=25&userId=5&eventType=LOGIN_SUCCESS
   */
  @Get('logs')
  async getAuditLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 25,
    @Query('userId') userId?: number,
    @Query('email') email?: string,
    @Query('eventType') eventType?: string,
    @Query('role') role?: string,
    @Query('success') success?: boolean,
  ) {
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (eventType) where.eventType = eventType;
    if (role) where.role = role;
    if (success !== undefined) where.success = success === true;

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.loginAudit.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.loginAudit.count({ where }),
    ]);

    return {
      page: Number(page),
      limit: Number(limit),
      total,
      logs,
    };
  }

  /**
   * Simple stats endpoint — total logins, fails, etc.
   */
  @Get('stats')
  async getAuditStats() {
    const successCount = await this.prisma.loginAudit.count({
      where: { success: true, eventType: 'LOGIN_SUCCESS' },
    });
    const failedCount = await this.prisma.loginAudit.count({
      where: { success: false, eventType: 'LOGIN_FAILED' },
    });
    const totalEvents = await this.prisma.loginAudit.count();

    return {
      totalEvents,
      successCount,
      failedCount,
      successRate:
        totalEvents === 0 ? 0 : Math.round((successCount / totalEvents) * 100),
    };
  }
}
