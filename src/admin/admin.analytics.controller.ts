import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../utils/prisma.service';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private prisma: PrismaService) {}

  @Get('events')
  async list(
    @Query('name') name?: string,
    @Query('userId') userId?: string,
    @Query('take') take?: string,
  ) {
    const takeN = Math.max(1, Math.min(500, Number(take || 100)));
    const userIdN = userId != null && userId !== '' ? Number(userId) : null;

    const where: any = {};
    if (name) where.name = String(name).trim();
    if (Number.isFinite(userIdN as any)) where.userId = userIdN;

    const items = await (this.prisma as any).analyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: takeN,
    });

    return { items };
  }
}

