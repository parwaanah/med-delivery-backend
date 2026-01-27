// src/orders/orders.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApprovalGuard } from '../common/guards/approval.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

import { OrderStatus } from '@prisma/client';
import { RateRiderDto } from './dto/rate-rider.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovalGuard, RateLimitGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ----------------------------------------------------------
  // CUSTOMER: create order
  // ----------------------------------------------------------
  @Post()
  @Roles('CUSTOMER')
  create(
    @Req() req: Request & { user: any },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(req.user.id, dto);
  }

  // ----------------------------------------------------------
  // CUSTOMER: upload prescription
  // ----------------------------------------------------------
  @Post(':id/prescription')
  @Roles('CUSTOMER')
  uploadPrescription(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
    @Body('url') url: string,
  ) {
    return this.ordersService.uploadPrescription(
      req.user.id,
      url,
      Number(id),
    );
  }

  // ----------------------------------------------------------
  // PHARMACY: request prescription
  // ----------------------------------------------------------
  @Post(':id/request-prescription')
  @Roles('PHARMACY')
  requestPrescription(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body() dto: { message?: string },
  ) {
    return this.ordersService.pharmacyRequestPrescription(
      req.user.id,
      Number(orderId),
      dto.message,
    );
  }

  // ----------------------------------------------------------
  // PHARMACY: accept / reject
  // ----------------------------------------------------------
  @Post(':id/pharmacy-response')
  @Roles('PHARMACY')
  @RateLimit({ key: 'orders.pharmacy-response', limit: 30, windowMs: 60_000 })
  pharmacyRespond(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body() dto: { action: 'ACCEPTED' | 'REJECTED' },
  ) {
    return this.ordersService.pharmacyRespond(
      req.user.id,
      Number(orderId),
      dto.action,
    );
  }

  // ----------------------------------------------------------
  // RIDER: accept / reject
  // ----------------------------------------------------------
  @Post(':id/rider-response')
  @Roles('RIDER')
  riderRespond(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body() dto: { action: 'ACCEPTED' | 'REJECTED'; reason?: string },
  ) {
    return this.ordersService.riderRespond(
      req.user.id,
      Number(orderId),
      dto.action,
      dto.reason,
    );
  }

  // ----------------------------------------------------------
  // RIDER: report delivery issues (customer unreachable, etc.)
  // ----------------------------------------------------------
  @Post(':id/rider-issue')
  @Roles('RIDER')
  riderIssue(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body()
    dto: {
      type: 'CUSTOMER_UNREACHABLE' | 'ADDRESS_ISSUE' | 'PAYMENT_ISSUE' | 'OTHER';
      note?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.ordersService.riderReportIssue(req.user.id, Number(orderId), dto);
  }

  // ----------------------------------------------------------
  // RIDER: update order stage
  // ----------------------------------------------------------
  @Patch(':id/stage')
  @Roles('RIDER')
  updateStage(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body()
    dto: {
      stage: OrderStatus;
      lat?: number;
      lng?: number;
      proofUrl?: string;
      signatureUrl?: string;
      otp?: string;
    },
  ) {
    if (!Object.values(OrderStatus).includes(dto.stage)) {
      throw new BadRequestException('Invalid order stage');
    }

    return this.ordersService.updateStage(
      req.user.id,
      Number(orderId),
      dto.stage,
      { lat: dto.lat, lng: dto.lng },
      {
        proofUrl: dto.proofUrl,
        signatureUrl: dto.signatureUrl,
        otp: dto.otp,
      },
    );
  }

  // ----------------------------------------------------------
  // CUSTOMER: rate rider (after delivery)
  // ----------------------------------------------------------
  @Post(':id/rate-rider')
  @Roles('CUSTOMER')
  rateRider(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body() dto: RateRiderDto,
  ) {
    return this.ordersService.rateRider(req.user.id, Number(orderId), dto);
  }

  // ----------------------------------------------------------
  // ROLE-BASED ORDER LISTING
  // ----------------------------------------------------------
  @Get()
  list(@Req() req: Request & { user: any }) {
    return this.ordersService.findByUser(
      req.user.id,
      req.user.role,
    );
  }

  // ----------------------------------------------------------
  // ROLE-BASED ORDER DETAIL
  // ----------------------------------------------------------
  @Get(':id')
  async getOne(
    @Req() req: Request & { user: any },
    @Param('id') id: string,
  ) {
    const order = await this.ordersService.getForUser(
      req.user.id,
      req.user.role,
      Number(id),
    );
    if (!order) {
      throw new BadRequestException('Order not found');
    }
    return order;
  }

  // ----------------------------------------------------------
  // TIMELINE
  // ----------------------------------------------------------
  @Get(':id/timeline')
  getTimeline(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getTimelineForUser(
      Number(req.user?.id),
      String(req.user?.role || ''),
      Number(orderId),
    );
  }

  // ----------------------------------------------------------
  // CUSTOMER: confirm / reject pharmacy changes
  // ----------------------------------------------------------
  @Post(':id/confirm-changes')
  @Roles('CUSTOMER')
  confirmChanges(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
  ) {
    return this.ordersService.customerConfirmChanges(
      req.user.id,
      Number(orderId),
    );
  }

  @Post(':id/reject-changes')
  @Roles('CUSTOMER')
  rejectChanges(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body() body: { reason?: string },
  ) {
    return this.ordersService.customerRejectChanges(
      req.user.id,
      Number(orderId),
      body?.reason,
    );
  }

  // ----------------------------------------------------------
  // CUSTOMER: cancel pending order
  // ----------------------------------------------------------
  @Post(':id/cancel')
  @Roles('CUSTOMER')
  cancel(
    @Req() req: Request & { user: any },
    @Param('id') orderId: string,
    @Body() body: { reason?: string },
  ) {
    return this.ordersService.customerCancelPending(
      req.user.id,
      Number(orderId),
      body?.reason,
    );
  }
}
