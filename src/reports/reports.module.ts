import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../utils/prisma.service';

@Module({
  providers: [ReportsService, PrismaService],
  exports: [ReportsService], // ✅ REQUIRED
})
export class ReportsModule {}
