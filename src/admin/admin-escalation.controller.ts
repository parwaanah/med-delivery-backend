// src/admin/admin-escalation.controller.ts

import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { EscalationService } from './escalation.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'ADMIN', 'admin')
@Controller('admin/orders')
export class AdminEscalationController {
  constructor(
    private prisma: PrismaService,
    private esc: EscalationService,
    private orders: OrdersService,
  ) {}

  // ==============================================
  // GET /admin/orders/escalated
  // ==============================================
  @Get('escalated')
  async getEscalated() {
    const notes = await this.prisma.notification.findMany({
      where: { type: 'ORDER_ESCALATION' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const items = [];

    for (const n of notes) {
      const orderId = (n.meta && (n.meta as any).orderId) || null;

      let order = null;
      if (orderId) {
        order = await this.prisma.order.findUnique({
          where: { id: Number(orderId) },
          include: {
            customer: { select: { email: true } },
            pharmacy: {
              select: { email: true, latitude: true, longitude: true },
            },
            rider: { select: { email: true } },
            items: true,
          },
        });
      }

      items.push({ notification: n, order });
    }

    return { total: items.length, items };
  }

  // ==============================================
  // GET /admin/orders/:id/riders
  // ==============================================
  @Get(':id/riders')
  async getCandidates(@Param('id') id: string) {
    const orderId = Number(id);
    if (isNaN(orderId)) throw new BadRequestException('Invalid order id');

    const candidates = await this.esc.findCandidatesForOrder(
      orderId,
      5, // search km or scoring limit
      50, // limit
    );

    const enriched = [];

    for (const c of candidates) {
      // Prisma expects number | undefined, NOT null
      const riderIdSafe =
        c?.riderId === null || c?.riderId === undefined
          ? undefined
          : Number(c.riderId);

      let user = null;

      if (riderIdSafe !== undefined) {
        user = await this.prisma.user
          .findUnique({
            where: { id: riderIdSafe },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              latitude: true,
              longitude: true,
            },
          })
          .catch(() => null);
      }

      enriched.push({ ...c, user });
    }

    return { total: enriched.length, candidates: enriched };
  }

  // ==============================================
  // POST /admin/orders/:id/assign/:riderId
  // ==============================================
  @Post(':id/assign/:riderId')
  async assign(@Param('id') id: string, @Param('riderId') riderId: string) {
    const orderId = Number(id);
    const rId = Number(riderId);

    if (isNaN(orderId) || isNaN(rId))
      throw new BadRequestException('Invalid ids');

    // In the future, extract from req.user.id
    const adminId = 1;

    return this.orders.adminAssign(orderId, adminId, rId);
  }
}
