import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private prisma: PrismaService) {}

  // ----------------------------------
  // VIEW LOGS (PAGINATED + FILTERED)
  // ----------------------------------
  @Get('logs')
  async getLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where: any = {};

    if (action) where.action = action;
    if (userId) where.userId = Number(userId);
    if (resource) where.resource = { contains: resource };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      page: Number(page),
      limit: take,
      total,
      logs,
    };
  }

  // ----------------------------------
  // CSV EXPORT (COMPLIANCE)
  // ----------------------------------
  @Get('export')
  async exportCsv(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const where: any = {};

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const header = 'id,userId,action,resource,createdAt\n';
    const rows = logs
      .map(
        (l) =>
          `${l.id},${l.userId ?? ''},"${l.action}","${l.resource ?? ''}",${l.createdAt.toISOString()}`,
      )
      .join('\n');

    const csv = header + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="audit_logs.csv"',
    );
    res.send(csv);
  }
}
