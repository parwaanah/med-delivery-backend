import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RiderPaymentsService } from './rider-payments.service';

@Controller('rider/earnings')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard)
@Roles(UserRole.RIDER)
export class RiderEarningsController {
  constructor(private readonly earnings: RiderPaymentsService) {}

  @Get('summary')
  summary(@Req() req: any) {
    return this.earnings.getSummary(Number(req.user.id));
  }

  @Get('transactions')
  transactions(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.earnings.getTransactions(Number(req.user.id), {
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }
}

