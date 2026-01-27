import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';
import { PrismaService } from '../utils/prisma.service';
import { AuditService } from '../utils/audit.service';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'USERS')
export class AdminPermissionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('admin/:id')
  async getAdminPerms(@Param('id') id: string) {
    const userId = Number(id);
    if (!Number.isFinite(userId)) throw new BadRequestException('Invalid user id');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.role !== UserRole.ADMIN) throw new BadRequestException('Target is not an admin');

    const rows = await (this.prisma as any).adminPermission.findMany({
      where: { userId },
      select: { code: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user: { id: user.id, email: user.email, role: user.role },
      permissions: rows.map((r: any) => String(r.code)),
    };
  }

  @Get('review')
  async reviewAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        adminPermissions: {
          select: { code: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return admins.map((a) => ({
      id: a.id,
      email: a.email,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      permissions: (a.adminPermissions || []).map((p) => String(p.code)),
    }));
  }

  @Get('export')
  async exportReview(@Req() req: any, @Res() res: Response) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        adminPermissions: { select: { code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'id,email,status,createdAt,permissions\n';
    const rows = admins
      .map((a) => {
        const perms = (a.adminPermissions || [])
          .map((p) => String(p.code))
          .join('|');
        return `${a.id},"${a.email ?? ''}",${a.status ?? ''},${a.createdAt.toISOString()},"${perms}"`;
      })
      .join('\n');

    await this.audit.logAdminAction({
      userId: Number(req.user?.id),
      action: 'ADMIN_PERMISSIONS_EXPORT',
      resource: 'admin_permissions',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="admin_permissions.csv"',
    );
    res.send(header + rows);
  }

  @Put('admin/:id')
  async setAdminPerms(@Req() req: any, @Param('id') id: string, @Body() body: { permissions?: string[] }) {
    const userId = Number(id);
    if (!Number.isFinite(userId)) throw new BadRequestException('Invalid user id');

    const perms = Array.isArray(body?.permissions) ? body.permissions : [];
    const normalized = Array.from(
      new Set(perms.map((p) => String(p || '').trim().toUpperCase()).filter(Boolean)),
    ).slice(0, 50);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (user.role !== UserRole.ADMIN) throw new BadRequestException('Target is not an admin');

    await this.prisma.$transaction([
      (this.prisma as any).adminPermission.deleteMany({ where: { userId } }),
      ...(normalized.length
        ? [
            (this.prisma as any).adminPermission.createMany({
              data: normalized.map((code) => ({ userId, code })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    await this.audit.logAdminAction({
      userId: Number(req.user?.id),
      action: 'ADMIN_PERMISSIONS_SET',
      resource: `user:${userId}`,
      meta: { permissions: normalized },
    });

    return { ok: true, permissions: normalized };
  }
}
