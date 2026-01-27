import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { RiderPaymentsService } from '../riders/rider-payments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/riders/settlements')
export class AdminRiderSettlementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: RiderPaymentsService,
  ) {}

  @Get('batches')
  async listBatches(@Query('limit') limit?: string) {
    const take = Math.min(200, Math.max(1, Number(limit) || 50));
    const items = await (this.prisma as any).riderSettlementBatch.findMany({
      orderBy: { id: 'desc' },
      take,
    });
    return { items, take };
  }

  @Get('batches/:id')
  async batch(@Param('id') id: string) {
    const batchId = Number(id);
    if (isNaN(batchId)) throw new BadRequestException('Invalid batch id');

    const batch = await (this.prisma as any).riderSettlementBatch.findUnique({
      where: { id: batchId },
      include: {
        earnings: {
          orderBy: { id: 'asc' },
          include: { order: { select: { id: true, status: true } } },
        },
      },
    });
    if (!batch) throw new BadRequestException('Batch not found');
    return batch;
  }

  @Post('batches')
  async createBatch(
    @Body()
    body: {
      periodStart: string;
      periodEnd: string;
    },
    @Req() req: any,
  ) {
    const start = new Date(body?.periodStart);
    const end = new Date(body?.periodEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid periodStart/periodEnd');
    }
    if (end <= start) throw new BadRequestException('periodEnd must be after start');

    return this.payments.createWeeklyBatch(start, end, Number(req.user.id));
  }

  @Patch('batches/:id/paid')
  async markPaid(@Param('id') id: string, @Req() req: any) {
    const batchId = Number(id);
    if (isNaN(batchId)) throw new BadRequestException('Invalid batch id');
    return this.payments.markBatchPaid(batchId, Number(req.user.id));
  }

  @Get('earnings')
  async listEarnings(
    @Query('riderId') riderId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(200, Math.max(1, Number(limit) || 50));
    const where: any = {};
    if (riderId) {
      const rid = Number(riderId);
      if (isNaN(rid)) throw new BadRequestException('Invalid riderId');
      where.riderId = rid;
    }
    if (status) where.status = String(status).toUpperCase();

    const items = await (this.prisma as any).riderEarning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { order: { select: { id: true, status: true, riderId: true } } },
    });
    return { items, take };
  }

  @Patch('earnings/:id/override')
  async overrideEarning(
    @Param('id') id: string,
    @Body() body: { bonus?: number; penalty?: number },
  ) {
    const earningId = Number(id);
    if (isNaN(earningId)) throw new BadRequestException('Invalid earning id');

    const updated = await this.payments.adminOverrideEarning(earningId, body || {});
    if (!updated) throw new BadRequestException('Earning not found');
    return updated;
  }
}
