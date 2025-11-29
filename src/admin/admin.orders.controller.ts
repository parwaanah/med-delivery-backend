import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { GeoSurgeService } from '../geosurge/geo-surge.service';

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private geo: GeoSurgeService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':id/riders')
  async getCandidateRiders(@Param('id') id: string) {
    const orderId = Number(id);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { pharmacy: true },
    });

    if (!order) return { total: 0, candidates: [] };

    const lat = order.pharmacy?.latitude;
    const lon = order.pharmacy?.longitude;

    if (!lat || !lon) return { total: 0, candidates: [] };

    const rawPoints = await this.geo.findNearbyPoints(lon, lat, 5, true, 50);
    const riders = rawPoints.filter((p) => /^rider:\d+$/.test(p.memberId));

    const scored = [];
    for (const rp of riders) {
      const score = await this.ordersService.getRiderScorePublic(rp, lat, lon);
      scored.push({ ...rp, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return { total: scored.length, candidates: scored };
  }
}
