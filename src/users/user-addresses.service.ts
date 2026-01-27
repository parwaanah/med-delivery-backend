import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

@Injectable()
export class UserAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number) {
    return (this.prisma as any).userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async create(userId: number, body: any) {
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();
    const line1 = String(body?.line1 || '').trim();
    const city = String(body?.city || '').trim();
    const pin = String(body?.pin || '').trim();
    if (!name || !phone || !line1 || !city || !pin) {
      throw new BadRequestException('Missing required fields');
    }

    const label = String(body?.label || 'Home').trim() || 'Home';
    const line2 = String(body?.line2 || '').trim() || '';
    const state = String(body?.state || '').trim() || '';
    const landmark = String(body?.landmark || '').trim() || '';
    const isDefault = Boolean(body?.isDefault);

    return this.prisma.$transaction(async (tx) => {
      const db: any = tx as any;

      const existingCount = await db.userAddress.count({ where: { userId } });
      const shouldDefault = isDefault || existingCount === 0;
      if (shouldDefault) {
        await db.userAddress.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      return db.userAddress.create({
        data: {
          userId,
          label,
          name,
          phone,
          line1,
          line2,
          city,
          state,
          pin,
          landmark,
          isDefault: shouldDefault,
        },
      });
    });
  }

  async update(userId: number, id: number, body: any) {
    const existing = await (this.prisma as any).userAddress.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Address not found');

    const data: any = {};
    if (body?.label != null) data.label = String(body.label || 'Home').trim() || 'Home';
    if (body?.name != null) data.name = String(body.name || '').trim();
    if (body?.phone != null) data.phone = String(body.phone || '').trim();
    if (body?.line1 != null) data.line1 = String(body.line1 || '').trim();
    if (body?.line2 != null) data.line2 = String(body.line2 || '').trim();
    if (body?.city != null) data.city = String(body.city || '').trim();
    if (body?.state != null) data.state = String(body.state || '').trim();
    if (body?.pin != null) data.pin = String(body.pin || '').trim();
    if (body?.landmark != null) data.landmark = String(body.landmark || '').trim();

    const wantsDefault = body?.isDefault === true;

    if (Object.keys(data).some((k) => ['name', 'phone', 'line1', 'city', 'pin'].includes(k))) {
      if (!data.name && body?.name != null) throw new BadRequestException('Invalid name');
      if (!data.phone && body?.phone != null) throw new BadRequestException('Invalid phone');
      if (!data.line1 && body?.line1 != null) throw new BadRequestException('Invalid line1');
      if (!data.city && body?.city != null) throw new BadRequestException('Invalid city');
      if (!data.pin && body?.pin != null) throw new BadRequestException('Invalid pin');
    }

    return this.prisma.$transaction(async (tx) => {
      const db: any = tx as any;

      if (wantsDefault) {
        await db.userAddress.updateMany({ where: { userId }, data: { isDefault: false } });
        data.isDefault = true;
      }

      return db.userAddress.update({
        where: { id },
        data,
      });
    });
  }

  async remove(userId: number, id: number) {
    const existing = await (this.prisma as any).userAddress.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Address not found');

    return this.prisma.$transaction(async (tx) => {
      const db: any = tx as any;
      await db.userAddress.delete({ where: { id } });

      // If default deleted, pick a new default (best effort).
      const remaining = await db.userAddress.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      if (remaining?.[0]) {
        const hasDefault = await db.userAddress.count({
          where: { userId, isDefault: true },
        });
        if (!hasDefault) {
          await db.userAddress.update({
            where: { id: remaining[0].id },
            data: { isDefault: true },
          });
        }
      }

      return { ok: true };
    });
  }
}

