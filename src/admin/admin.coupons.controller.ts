import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../utils/prisma.service';

type CouponTypeString = 'PERCENT' | 'FLAT';

type CouponUpsertBody = {
  code: string;
  type: CouponTypeString;
  amount: number;
  minOrder?: number;
  maxDiscount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  perUserLimit?: number;
  active?: boolean;
};

function toDecimal(n: number) {
  if (!Number.isFinite(n)) throw new BadRequestException('Invalid amount');
  if (n < 0) throw new BadRequestException('Amount must be >= 0');
  return new Prisma.Decimal(n);
}

function parseDate(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return d;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    return (this.prisma as any).coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Post()
  async create(@Body() body: CouponUpsertBody) {
    const code = String(body?.code || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('code is required');

    const type = String((body as any)?.type || '').trim().toUpperCase();
    if (!['PERCENT', 'FLAT'].includes(type)) {
      throw new BadRequestException('Invalid coupon type');
    }

    const startsAt = parseDate(body?.startsAt);
    const endsAt = parseDate(body?.endsAt);
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new BadRequestException('startsAt must be <= endsAt');
    }

    return (this.prisma as any).coupon.create({
      data: {
        code,
        type,
        amount: toDecimal(Number(body.amount)),
        minOrder: body.minOrder != null ? toDecimal(Number(body.minOrder)) : null,
        maxDiscount:
          body.maxDiscount != null ? toDecimal(Number(body.maxDiscount)) : null,
        startsAt,
        endsAt,
        usageLimit:
          body.usageLimit != null ? Number(body.usageLimit) : null,
        perUserLimit:
          body.perUserLimit != null ? Number(body.perUserLimit) : null,
        active: body.active != null ? Boolean(body.active) : true,
      },
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<CouponUpsertBody>) {
    const couponId = Number(id);
    if (!Number.isFinite(couponId)) throw new BadRequestException('Invalid id');

    const data: any = {};
    if (body.code != null) data.code = String(body.code).trim().toUpperCase();
    if (body.type != null) {
      const type = String(body.type).trim().toUpperCase();
      if (!['PERCENT', 'FLAT'].includes(type)) {
        throw new BadRequestException('Invalid coupon type');
      }
      data.type = type;
    }
    if (body.amount != null) data.amount = toDecimal(Number(body.amount));
    if (body.minOrder != null) data.minOrder = toDecimal(Number(body.minOrder));
    if (body.maxDiscount != null)
      data.maxDiscount = toDecimal(Number(body.maxDiscount));
    if (body.startsAt !== undefined) data.startsAt = parseDate(body.startsAt) as any;
    if (body.endsAt !== undefined) data.endsAt = parseDate(body.endsAt) as any;
    if (body.usageLimit !== undefined)
      data.usageLimit = body.usageLimit != null ? Number(body.usageLimit) : null;
    if (body.perUserLimit !== undefined)
      data.perUserLimit =
        body.perUserLimit != null ? Number(body.perUserLimit) : null;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (data.startsAt && data.endsAt && data.startsAt > data.endsAt) {
      throw new BadRequestException('startsAt must be <= endsAt');
    }

    return (this.prisma as any).coupon.update({ where: { id: couponId }, data });
  }
}
