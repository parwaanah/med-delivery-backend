import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RefundsService } from './refunds.service';
import { RequestRefundDto } from './dto/request-refund.dto';
import { AdminResolveRefundDto } from './dto/admin-resolve-refund.dto';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  // CUSTOMER: request a refund
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('request')
  request(@Req() req: any, @Body() dto: RequestRefundDto) {
    const orderId = Number(dto?.orderId);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid orderId');
    return this.refunds.requestRefund(Number(req.user?.id), orderId, {
      amount: dto.amount,
      reason: dto.reason,
    });
  }

  // CUSTOMER: list own refund requests
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('me')
  me(@Req() req: any) {
    return this.refunds.listMyRequests(Number(req.user?.id));
  }

  // ADMIN: list refund requests
  @UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
  @Roles(UserRole.ADMIN)
  @AdminPerms('SUPERADMIN', 'FINANCE')
  @Get('admin')
  adminList(@Query('status') status?: string) {
    return this.refunds.adminList({ status });
  }

  // ADMIN: get single request
  @UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
  @Roles(UserRole.ADMIN)
  @AdminPerms('SUPERADMIN', 'FINANCE')
  @Get('admin/:id')
  adminGet(@Param('id') id: string) {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new BadRequestException('Invalid id');
    return this.refunds.adminGet(rid);
  }

  // ADMIN: approve (triggers refund)
  @UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
  @Roles(UserRole.ADMIN)
  @AdminPerms('SUPERADMIN', 'FINANCE')
  @Post('admin/:id/approve')
  adminApprove(@Req() req: any, @Param('id') id: string, @Body() dto: AdminResolveRefundDto) {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new BadRequestException('Invalid id');
    return this.refunds.adminApprove(rid, Number(req.user?.id), {
      amount: dto?.amount,
      note: dto?.note,
    });
  }

  // ADMIN: reject
  @UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
  @Roles(UserRole.ADMIN)
  @AdminPerms('SUPERADMIN', 'FINANCE')
  @Post('admin/:id/reject')
  adminReject(@Req() req: any, @Param('id') id: string, @Body() dto: AdminResolveRefundDto) {
    const rid = Number(id);
    if (!Number.isFinite(rid)) throw new BadRequestException('Invalid id');
    return this.refunds.adminReject(rid, Number(req.user?.id), { note: dto?.note });
  }
}
