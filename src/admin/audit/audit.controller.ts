import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // 📜 Get all audit logs
  @Get()
  async getAll() {
    return this.auditService.getAllLogs();
  }

  // 🔍 Filter logs by role, target type, date range
  @Get('filter')
  async filter(
    @Query('role') role?: string,
    @Query('targetType') targetType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.auditService.filterLogs(role, targetType, fromDate, toDate);
  }
}
