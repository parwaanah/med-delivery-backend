import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, 'ADMIN', 'admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getAllOrders() {
    const orders = await this.prisma.order.findMany({
      include: {
        customer: { select: { email: true } },
        pharmacy: { select: { email: true } },
        rider: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      total: orders.length,
      orders,
    };
  }
}
