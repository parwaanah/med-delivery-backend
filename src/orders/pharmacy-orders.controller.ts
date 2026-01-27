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
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, OrderStatus } from '@prisma/client';
import { Request } from 'express';
import { PharmacyAcceptDto } from './dto/pharmacy-accept.dto';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Controller('pharmacy/orders')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard, RateLimitGuard)
@Roles(UserRole.PHARMACY)
export class PharmacyOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Req() req: Request & { user: any },
    @Query('status') status?: OrderStatus,
  ) {
    return this.orders.listForPharmacy(req.user.id, status);
  }

  @Get(':id')
  get(@Req() req: Request & { user: any }, @Param('id') id: string) {
    return this.orders.getForPharmacy(req.user.id, Number(id));
  }

  @Post(':id/accept')
  @RateLimit({ key: 'pharmacy.orders.accept', limit: 30, windowMs: 60_000 })
  accept(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
    @Body() body: PharmacyAcceptDto,
  ) {
    if (
      body?.totalPrice != null &&
      !Number.isFinite(Number(body.totalPrice))
    ) {
      throw new BadRequestException('Invalid totalPrice');
    }

    return this.orders.pharmacyAccept(req.user.id, Number(id), body);
  }

  @Post(':id/reject')
  @RateLimit({ key: 'pharmacy.orders.reject', limit: 30, windowMs: 60_000 })
  reject(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.orders.pharmacyReject(req.user.id, Number(id), reason);
  }

  @Post(':id/request-prescription')
  @RateLimit({
    key: 'pharmacy.orders.request-prescription',
    limit: 60,
    windowMs: 60_000,
  })
  requestPrescription(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
    @Body('message') message?: string,
  ) {
    return this.orders.pharmacyRequestPrescription(
      req.user.id,
      Number(id),
      message,
    );
  }

  @Post(':id/mark-ready')
  @RateLimit({ key: 'pharmacy.orders.mark-ready', limit: 60, windowMs: 60_000 })
  markReady(@Req() req: Request & { user: any }, @Param('id') id: string) {
    return this.orders.pharmacyMarkReady(req.user.id, Number(id));
  }

  @Post(':id/confirm-handover')
  @RateLimit({
    key: 'pharmacy.orders.confirm-handover',
    limit: 60,
    windowMs: 60_000,
  })
  confirmHandover(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
  ) {
    return this.orders.pharmacyConfirmHandover(req.user.id, Number(id));
  }

  @Post(':id/prescription/verify')
  @RateLimit({
    key: 'pharmacy.orders.prescription-verify',
    limit: 60,
    windowMs: 60_000,
  })
  verifyPrescription(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
  ) {
    return this.orders.pharmacyVerifyPrescription(req.user.id, Number(id));
  }
}
