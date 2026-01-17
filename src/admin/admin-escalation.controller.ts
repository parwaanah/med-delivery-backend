// src/admin/admin-escalation.controller.ts
import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { EscalationService } from './escalation.service';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/orders')
export class AdminEscalationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly esc: EscalationService,
    private readonly orders: OrdersService,
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

    const items: any[] = [];

    for (const n of notes) {
      const orderId = (n.meta as any)?.orderId;
      if (!orderId) continue;

      const order = await this.prisma.order.findUnique({
        where: { id: Number(orderId) },
        include: {
          customer: { select: { email: true } },
          pharmacy: { select: { email: true } },
          rider: { select: { email: true } },
          items: true,
        },
      });

      // Still escalated only if no rider
      if (order && !order.riderId) {
        items.push({ notification: n, order });
      }
    }

    return { total: items.length, items };
  }

  // ==============================================
  // GET /admin/orders/:id/riders
  // ==============================================
  @Get(':id/riders')
  async getCandidates(@Param('id') id: string) {
    const orderId = Number(id);
    if (isNaN(orderId)) {
      throw new BadRequestException('Invalid order id');
    }

    const candidates = await this.esc.findCandidatesForOrder(orderId, 5, 50);

    const enriched = await Promise.all(
      candidates.map(async (c) => {
        const riderId =
          c?.riderId === null || c?.riderId === undefined
            ? null
            : Number(c.riderId);

        if (!riderId) return { ...c, user: null };

        const user = await this.prisma.user.findUnique({
          where: { id: riderId },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            latitude: true,
            longitude: true,
          },
        });

        return { ...c, user };
      }),
    );

    return { total: enriched.length, candidates: enriched };
  }

  // ==============================================
  // POST /admin/orders/:id/assign/:riderId
  // ==============================================
  @Post(':id/assign/:riderId')
  async assign(
    @Param('id') id: string,
    @Param('riderId') riderId: string,
    @Req() req: any,
  ) {
    const orderId = Number(id);
    const rId = Number(riderId);

    if (isNaN(orderId) || isNaN(rId)) {
      throw new BadRequestException('Invalid ids');
    }

    const adminId = req.user.id;
    return this.orders.adminAssign(orderId, adminId, rId);
  }
}
