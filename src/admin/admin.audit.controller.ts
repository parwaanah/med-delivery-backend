import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private prisma: PrismaService) {}

  /**
   * ✅ Fetch paginated or default (last 100) audit logs
   */
  @Get('logs')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('email') email?: string,
    @Query('eventType') eventType?: string,
    @Query('role') role?: string,
    @Query('success') success?: string,
  ) {
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 100;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (eventType) where.eventType = eventType;
    if (role) where.role = role;
    if (success !== undefined)
      where.success = success === 'true' || success === '1';

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.loginAudit.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.loginAudit.count({ where }),
    ]);

    return {
      page: pageNum,
      limit: limitNum,
      total,
      logs,
    };
  }

  /**
   * ✅ Simple audit statistics summary
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
      lastUpdated: new Date().toISOString(),
    };
  }
}
