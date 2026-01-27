// src/admin/admin.pharmacies.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { OrdersService } from '../orders/orders.service';
import { AuditService } from '../utils/audit.service';
import { NotificationService } from '../utils/notification.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/pharmacies')
export class AdminPharmaciesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsGateway,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  @Get(':id/inventory')
  async inventory(@Param('id') id: string) {
    const pharmacyId = Number(id);
    if (isNaN(pharmacyId)) throw new BadRequestException('Invalid pharmacy id');

    const pharmacy = await this.prisma.user.findUnique({
      where: { id: pharmacyId },
      select: { id: true, role: true },
    });
    if (!pharmacy || pharmacy.role !== UserRole.PHARMACY) {
      throw new BadRequestException('Pharmacy not found');
    }

    const items = await this.prisma.pharmacyInventory.findMany(({
      where: { pharmacyId, deletedAt: null },
      include: {
        medicine: { select: { id: true, name: true, rxType: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    } as any));

    return { pharmacyId, items };
  }

  @Patch(':id/freeze')
  async freeze(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const pharmacyId = Number(id);
    if (isNaN(pharmacyId)) throw new BadRequestException('Invalid pharmacy id');

    const user = await this.prisma.user.findUnique({
      where: { id: pharmacyId },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== UserRole.PHARMACY) {
      throw new BadRequestException('Pharmacy not found');
    }

    await this.prisma.user.update({
      where: { id: pharmacyId },
      data: { status: 'SUSPENDED' },
    });

    this.ws.notifyUser(pharmacyId, 'user.status', { status: 'SUSPENDED' });
    await this.notify.create(
      pharmacyId,
      'ACCOUNT_SUSPENDED',
      'Your pharmacy account was suspended by admin. Contact support.',
      { status: 'SUSPENDED', reason: body?.reason },
      req.user.id,
    );

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'PHARMACY_FREEZE',
      resource: `pharmacy:${pharmacyId}`,
      meta: { from: user.status, to: 'SUSPENDED', reason: body?.reason },
    });

    return { ok: true, status: 'SUSPENDED' };
  }

  @Patch(':id/unfreeze')
  async unfreeze(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any,
  ) {
    const pharmacyId = Number(id);
    if (isNaN(pharmacyId)) throw new BadRequestException('Invalid pharmacy id');

    const user = await this.prisma.user.findUnique({
      where: { id: pharmacyId },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== UserRole.PHARMACY) {
      throw new BadRequestException('Pharmacy not found');
    }

    await this.prisma.user.update({
      where: { id: pharmacyId },
      data: { status: 'APPROVED' },
    });

    this.ws.notifyUser(pharmacyId, 'user.status', { status: 'APPROVED' });
    await this.notify.create(
      pharmacyId,
      'ACCOUNT_RESTORED',
      'Your pharmacy account is active again.',
      { status: 'APPROVED', reason: body?.reason },
      req.user.id,
    );

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'PHARMACY_UNFREEZE',
      resource: `pharmacy:${pharmacyId}`,
      meta: { from: user.status, to: 'APPROVED', reason: body?.reason },
    });

    return { ok: true, status: 'APPROVED' };
  }

  @Post(':id/unassign-orders')
  async unassignOrders(@Param('id') id: string, @Req() req: any) {
    const pharmacyId = Number(id);
    if (isNaN(pharmacyId)) throw new BadRequestException('Invalid pharmacy id');

    const pharmacy = await this.prisma.user.findUnique({
      where: { id: pharmacyId },
      select: { id: true, role: true },
    });
    if (!pharmacy || pharmacy.role !== UserRole.PHARMACY) {
      throw new BadRequestException('Pharmacy not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        pharmacyId,
        riderId: { not: null },
        status: {
          in: [
            OrderStatus.ASSIGNED,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.REACHED_PHARMACY,
            OrderStatus.PICKED_UP,
          ],
        },
      },
      select: { id: true },
      take: 500,
    });

    let count = 0;
    for (const o of orders) {
      await this.orders.adminUnassignRider(o.id);
      count += 1;
    }

    await this.audit.logAdminAction({
      userId: req.user.id,
      action: 'PHARMACY_FORCE_UNASSIGN_ORDERS',
      resource: `pharmacy:${pharmacyId}`,
      meta: { count },
    });

    return { ok: true, count };
  }
}
