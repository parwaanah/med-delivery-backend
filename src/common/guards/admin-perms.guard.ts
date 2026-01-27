import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../utils/prisma.service';
import { ADMIN_PERMS_KEY } from '../decorators/admin-perms.decorator';

function enforceEnabled() {
  return String(process.env.ADMIN_PERMS_ENFORCE || '').trim() === '1';
}

@Injectable()
export class AdminPermsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.get<string[]>(ADMIN_PERMS_KEY, context.getHandler()) ??
      this.reflector.get<string[]>(ADMIN_PERMS_KEY, context.getClass());

    if (!required || required.length === 0) return true;
    if (!enforceEnabled()) return true; // backward compatible default

    const req = context.switchToHttp().getRequest();
    const user = req?.user;
    const userId = Number(user?.id);
    const role = String(user?.role || '').toUpperCase();

    if (role !== 'ADMIN') return true; // allow non-admins (guard is used on admin routes anyway)
    if (!Number.isFinite(userId)) throw new ForbiddenException('Unauthorized');

    const rows = await (this.prisma as any).adminPermission.findMany({
      where: { userId },
      select: { code: true },
    });

    const codes = new Set(
      (rows || [])
        .map((r: any) => String(r?.code || '').toUpperCase())
        .filter(Boolean),
    );

    if (codes.has('SUPERADMIN')) return true;

    for (const p of required) {
      const code = String(p || '').toUpperCase();
      if (codes.has(code)) return true; // ANY match
    }

    throw new ForbiddenException('Insufficient admin permissions');
  }
}

