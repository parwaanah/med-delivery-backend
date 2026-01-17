import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ReportsService } from '../reports/reports.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  // -------------------------------
  // SYSTEM SUMMARY
  // -------------------------------
  @Get('summary')
  async summary() {
    return this.reports.getSystemSummary();
  }

  // -------------------------------
  // TRANSACTIONS
  // -------------------------------
  @Get('transactions')
  async transactions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.reports.getTransactions({
      page: Number(page),
      limit: Number(limit),
      status,
    });
  }

  // -------------------------------
  // DAILY EXPORT (CSV / PDF / JSON)
  // -------------------------------
  @Get('export/daily')
  async exportDaily(
    @Query('format') format: 'csv' | 'pdf' | 'json' = 'csv',
    @Res() res: Response,
  ) {
    const files = await this.reports.generateDailyReport();

    const filePath =
      format === 'pdf'
        ? files.pdf
        : format === 'json'
        ? files.json
        : files.csv;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Report file not found' });
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${path.basename(filePath)}"`,
    );

    return res.sendFile(path.resolve(filePath));
  }
}
