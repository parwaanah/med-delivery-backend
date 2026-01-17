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

import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
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
    @Body() dto: { action: 'ACCEPTED' | 'REJECTED' },
  ) {
    return this.ordersService.riderRespond(
      req.user.id,
      Number(orderId),
      dto.action,
    );
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
    );
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
  // TIMELINE
  // ----------------------------------------------------------
  @Get(':id/timeline')
  getTimeline(@Param('id') orderId: string) {
    return this.ordersService.getTimeline(Number(orderId));
  }
}
