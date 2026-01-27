// src/auth/session.controller.ts
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';
import { UserRole } from '@prisma/client';
import { AuditService } from '../utils/audit.service';

@ApiTags('Sessions')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  async getMySessions(@Req() req: any) {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId)) throw new ForbiddenException('Unauthorized');

    return this.prisma.session.findMany({
      where: { userId, revoked: false },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseGuards(AdminPermsGuard)
  @AdminPerms('SUPERADMIN', 'SECURITY', 'USERS')
  @Get(':userId')
  async getUserSessions(@Req() req: any, @Param('userId') userId: string) {
    const idNum = Number(userId);
    if (!Number.isFinite(idNum)) throw new BadRequestException('Invalid userId');

    const sessions = await this.prisma.session.findMany({
      where: { userId: idNum, revoked: false },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.audit.logAdminAction({
      userId: Number((req as any)?.user?.id),
      action: 'ADMIN_SESSIONS_VIEW',
      resource: `user:${idNum}`,
    });

    return sessions;
  }

  @Post('revoke')
  async revokeSession(@Req() req: any) {
    const sessionId = Number(req.body?.sessionId);
    if (!Number.isFinite(sessionId))
      throw new BadRequestException('Invalid sessionId');

    const actorId = Number(req.user?.id);
    const actorRole = String(req.user?.role || '').toUpperCase();
    const isAdmin = actorRole === String(UserRole.ADMIN);
    if (!Number.isFinite(actorId)) throw new ForbiddenException('Unauthorized');

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, revoked: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (!isAdmin && session.userId !== actorId) {
      throw new ForbiddenException('Cannot revoke another user session');
    }

    if (!session.revoked) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revoked: true },
      });
    }

    await this.prisma.refreshToken.updateMany({
      where: { sessionId },
      data: { revoked: true },
    });

    if (isAdmin && session.userId !== actorId) {
      await this.audit.logAdminAction({
        userId: actorId,
        action: 'ADMIN_SESSION_REVOKE',
        resource: `session:${sessionId}`,
        meta: { targetUserId: session.userId },
      });
    }

    return { message: `Session ${sessionId} revoked` };
  }

  @UseGuards(RolesGuard, AdminPermsGuard)
  @Roles(UserRole.ADMIN)
  @AdminPerms('SUPERADMIN', 'SECURITY', 'USERS')
  @Post('admin/:userId/revoke-all')
  async revokeAllForUser(@Req() req: any, @Param('userId') userId: string) {
    const idNum = Number(userId);
    if (!Number.isFinite(idNum)) throw new BadRequestException('Invalid userId');

    await this.prisma.session.updateMany({
      where: { userId: idNum, revoked: false },
      data: { revoked: true },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: idNum, revoked: false },
      data: { revoked: true },
    });

    await this.audit.logAdminAction({
      userId: Number(req.user?.id),
      action: 'ADMIN_SESSIONS_REVOKE_ALL',
      resource: `user:${idNum}`,
    });

    return { ok: true };
  }
}
