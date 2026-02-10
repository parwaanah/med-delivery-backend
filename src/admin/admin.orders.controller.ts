// src/admin/admin.orders.controller.ts
import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, OrderStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { AuditService } from '../utils/audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Post(':id/cancel')
  async forceCancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminForceCancel(
      orderId,
      body?.reason,
      req.user.id,
    );

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_FORCE_CANCEL',
      resource: `order:${orderId}`,
      meta: { reason: body?.reason },
    });

    return res;
  }

  @Patch(':id/status')
  async forceStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus; note?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminForceStatus(
      orderId,
      body.status,
      body.note,
      req.user.id,
    );

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_FORCE_STATUS',
      resource: `order:${orderId}`,
      meta: { to: body.status, note: body.note },
    });

    return res;
  }

  @Post(':id/unassign')
  async unassignRider(@Param('id') id: string, @Req() req: any) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminUnassignRider(orderId, req.user.id);

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_UNASSIGN_RIDER',
      resource: `order:${orderId}`,
    });

    return res;
  }

  @Post(':id/note')
  async addNote(
    @Param('id') id: string,
    @Body() body: { note: string },
    @Req() req: any,
  ) {
    if (!body?.note?.trim())
      throw new BadRequestException('Note required');

    const orderId = Number(id);
    const res = await this.orders.adminAddNote(orderId, body.note.trim());

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_ADMIN_NOTE',
      resource: `order:${orderId}`,
      meta: { note: body.note },
    });

    return res;
  }

  @Patch(':id/settle')
  async settle(
    @Param('id') id: string,
    @Body() body: { note?: string; force?: boolean },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminSettleOrder(orderId, req.user.id, {
      note: body?.note,
      force: Boolean(body?.force),
    });

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_SETTLED',
      resource: `order:${orderId}`,
      meta: { note: body?.note, force: Boolean(body?.force) },
    });

    return res;
  }

  @Patch(':id/unsettle')
  async unsettle(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminUnsettleOrder(orderId, req.user.id, {
      note: body?.note,
    });

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'ORDER_UNSETTLED',
      resource: `order:${orderId}`,
      meta: { note: body?.note },
    });

    return res;
  }

  @Post(':id/prescription/verify')
  async verifyPrescription(@Param('id') id: string, @Req() req: any) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminVerifyPrescription(orderId, req.user.id);

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'PRESCRIPTION_VERIFIED',
      resource: `order:${orderId}`,
    });

    return res;
  }

  @Post(':id/prescription/reject')
  async rejectPrescription(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const res = await this.orders.adminRejectPrescription(orderId, req.user.id, body?.reason);

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'PRESCRIPTION_REJECTED',
      resource: `order:${orderId}`,
      meta: { reason: body?.reason },
    });

    return res;
  }
}
