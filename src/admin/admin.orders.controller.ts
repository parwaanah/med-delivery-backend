import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
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

  // 🔍 PUBLIC DEBUG ENDPOINT (NO AUTH)
  @Get('debug/redis')
  async debugRedis() {
    const geoClient = this.geo['redis'];

    const keys = await geoClient.keys('*');
    const riderCount = await geoClient.zcard('geosurge:riders');
    const allPoints = await geoClient.zrange('geosurge:riders', 0, -1, 'WITHSCORES');

    const meta: Record<string, any> = {};
    for (let i = 0; i < allPoints.length; i += 2) {
      const memberId = allPoints[i];
      const h = await geoClient.hgetall(`geo:meta:${memberId}`);
      meta[memberId] = h;
    }

    return {
      keys,
      riderCount,
      allPoints,
      meta,
    };
  }

  /** ⭐ GET ALL ORDERS (PROTECTED) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, 'ADMIN', 'admin')
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

    return { total: orders.length, orders };
  }

  /** ⭐ MANUAL RIDER ASSIGN (NEW — PROTECTED) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, 'ADMIN', 'admin')
  @Post(':id/assign')
  async assignRider(
    @Param('id') id: string,
    @Body() body: { adminId: number; riderId: number }
  ) {
    const orderId = Number(id);
    const { adminId, riderId } = body;

    // validate
    if (!orderId || !riderId) {
      return { error: 'Invalid orderId or riderId' };
    }

    return this.ordersService.adminAssign(orderId, adminId, riderId);
  }

  /** ⭐ GET RIDER CANDIDATES FOR AN ORDER (PROTECTED) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, 'ADMIN', 'admin')
  @Get(':id/riders')
  async getCandidateRiders(@Param('id') id: string) {
    const orderId = Number(id);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pharmacy: { select: { latitude: true, longitude: true } },
      },
    });

    if (!order) return { total: 0, candidates: [] };

    // TEMP DEBUG LOGS (safe to keep)
    console.log('🔍 ORDER ID:', orderId);
    console.log('🔍 ORDER PHARMACY LAT/LON:', order.pharmacy?.latitude, order.pharmacy?.longitude);

    const searchLat = order.pharmacy?.latitude;
    const searchLon = order.pharmacy?.longitude;

    if (!searchLat || !searchLon) {
      return { total: 0, candidates: [] };
    }

    const rawPoints = await this.geo.findNearbyPoints(searchLon, searchLat, 5, true, 50);
    if (!rawPoints || rawPoints.length === 0) return { total: 0, candidates: [] };

    const riderPoints = rawPoints.filter((p) => /^rider:\d+$/.test(p.memberId));
    if (riderPoints.length === 0) return { total: 0, candidates: [] };

    const scored: Array<any> = [];
    for (const rp of riderPoints) {
      // reuse OrdersService scoring logic (private access)
      const score = await this.ordersService['computeRiderScore'](rp, searchLat, searchLon);
      scored.push({ ...rp, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return {
      total: scored.length,
      candidates: scored,
    };
  }
}
