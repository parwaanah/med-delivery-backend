import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
  Query,
  Delete,
  Body,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { WsGateway } from '../ws/ws.gateway';
import { NotificationService } from '../utils/notification.service';
import { AuditService } from '../utils/audit.service';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';

@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'USERS')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private prisma: PrismaService,
    private ws: WsGateway,
    private notify: NotificationService,
    private audit: AuditService,
  ) {}

  private profileSummary(profile: any) {
    const data = profile?.data || {};
    return {
      pharmacyName: data?.pharmacyName ?? null,
      ownerName: data?.ownerName ?? null,
      city: data?.address?.city ?? null,
      pin: data?.address?.pin ?? null,
      drugLicenseNumber: data?.drugLicenseNumber ?? null,
      gstNumber: data?.gstNumber ?? null,
      openingHours: data?.openingHours ?? null,
    };
  }

  private docCounts(docs: any[]) {
    const total = docs.length;
    const verified = docs.filter((d) => d.verified).length;
    return { total, verified, pending: total - verified };
  }

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    if (status) {
      where.status = status;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { partnerProfile: true, verificationDocs: true },
    });

    const items = users.map((u) => ({
      ...u,
      partnerProfile: u.partnerProfile
        ? this.profileSummary(u.partnerProfile)
        : null,
      docCounts: this.docCounts(u.verificationDocs || []),
      verificationDocs: undefined,
    }));

    return { users: items };
  }

  @Get('pending/:role')
  async pending(@Param('role') role: string) {
    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestException('Invalid role');
    }

    const users = await this.prisma.user.findMany({
      where: { role: role as UserRole, status: 'PENDING' },
      include: { verificationDocs: true, partnerProfile: true },
      orderBy: { createdAt: 'asc' },
    });

    const items = users.map((u) => ({
      ...u,
      partnerProfile: u.partnerProfile
        ? this.profileSummary(u.partnerProfile)
        : null,
      docCounts: this.docCounts(u.verificationDocs || []),
      verificationDocs: undefined,
    }));

    return { users: items };
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    const userId = Number(id);

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, role: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data:
        before?.role === UserRole.RIDER
          ? ({ status: 'ACTIVE', riderAvailability: 'AVAILABLE' } as any)
          : { status: 'APPROVED' },
    });

    this.ws.notifyUser(userId, 'user.approved', {
      status: before?.role === UserRole.RIDER ? 'ACTIVE' : 'APPROVED',
    });

    await this.notify.create(
      userId,
      'ACCOUNT_APPROVED',
      'Your account has been approved by admin',
      { status: before?.role === UserRole.RIDER ? 'ACTIVE' : 'APPROVED' },
      req.user?.id,
    );

    await this.audit.logAdminAction({
      userId: req.user?.id,
      action: 'USER_APPROVED',
      resource: `user:${userId}`,
      meta: { from: before?.status, to: 'APPROVED', role: before?.role },
    });

    return { success: true };
  }

  @Get(':id/documents')
  async documents(@Param('id') id: string) {
    const userId = Number(id);
    if (isNaN(userId)) throw new BadRequestException('Invalid user');

    return this.prisma.verificationDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/documents/:docId/verify')
  async verifyDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: any,
  ) {
    const userId = Number(id);
    const documentId = Number(docId);

    await this.prisma.verificationDocument.update({
      where: { id: documentId },
      data: { verified: true },
    });

    this.ws.notifyUser(userId, 'doc.verified', {
      id: documentId,
      verified: true,
    });

    await this.notify.create(
      userId,
      'DOC_VERIFIED',
      'A document was verified by admin',
      { docId: documentId, verified: true },
      req.user?.id,
    );

    const remaining = await this.prisma.verificationDocument.count({
      where: { userId, verified: false },
    });

    if (remaining === 0) {
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      const isRider = current?.role === UserRole.RIDER;
      await this.prisma.user.update({
        where: { id: userId },
        data: isRider
          ? ({ status: 'ACTIVE', riderAvailability: 'AVAILABLE' } as any)
          : { status: 'APPROVED' },
      });

      this.ws.notifyUser(userId, 'user.approved', {
        status: isRider ? 'ACTIVE' : 'APPROVED',
      });
      await this.notify.create(
        userId,
        'ACCOUNT_APPROVED',
        'All documents verified. Your account has been approved.',
        { status: isRider ? 'ACTIVE' : 'APPROVED' },
        req.user?.id,
      );
    }

    return { success: true };
  }

  @Patch(':id/documents/:docId/reject')
  async rejectDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: any,
  ) {
    const userId = Number(id);
    const documentId = Number(docId);

    await this.prisma.verificationDocument.delete({
      where: { id: documentId },
    });

    this.ws.notifyUser(userId, 'doc.rejected', {
      id: documentId,
      rejected: true,
    });

    await this.notify.create(
      userId,
      'DOC_REJECTED',
      'A document was rejected by admin',
      { docId: documentId, rejected: true },
      req.user?.id,
    );

    return { success: true };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Req() req: any) {
    const userId = Number(id);

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, role: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'REJECTED' },
    });

    this.ws.notifyUser(userId, 'user.rejected', { status: 'REJECTED' });

    await this.notify.create(
      userId,
      'ACCOUNT_REJECTED',
      'Your account was rejected by admin',
      { status: 'REJECTED' },
      req.user?.id,
    );

    await this.audit.logAdminAction({
      userId: req.user?.id,
      action: 'USER_REJECTED',
      resource: `user:${userId}`,
      meta: { from: before?.status, to: 'REJECTED', role: before?.role },
    });

    return { success: true };
  }

  @Patch(':id/status')
  async overrideStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Query('value') value?: string,
  ) {
    const userId = Number(id);
    if (!value) throw new BadRequestException('Status value required');

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, role: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: value },
    });

    this.ws.notifyUser(userId, 'user.status', { status: value });
    await this.notify.create(
      userId,
      'ACCOUNT_STATUS_CHANGED',
      `Your account status is now ${value}`,
      { status: value },
      req.user?.id,
    );

    await this.audit.logAdminAction({
      userId: req.user?.id,
      action: 'USER_STATUS_OVERRIDE',
      resource: `user:${userId}`,
      meta: { from: before?.status, to: value, role: before?.role },
    });

    return { success: true };
  }

  @Post(':id/message')
  async messageUser(
    @Param('id') id: string,
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    const userId = Number(id);
    if (isNaN(userId)) throw new BadRequestException('Invalid user');
    const message = String(body?.message || '').trim();
    if (!message) throw new BadRequestException('Message is required');

    await this.notify.create(
      userId,
      'ADMIN_MESSAGE',
      message,
      { from: 'ADMIN' },
      req.user?.id,
    );

    await this.audit.logAdminAction({
      userId: req.user?.id,
      action: 'ADMIN_MESSAGE_SENT',
      resource: `user:${userId}`,
      meta: { message },
    });

    return { success: true };
  }

  // ----------------------------------------------------------
  // RIDER CONTROL PLANE (ADMIN)
  // ----------------------------------------------------------
  @Patch(':id/rider/suspend')
  async suspendRider(
    @Param('id') id: string,
    @Body()
    body: { code: 'FRAUD' | 'INACTIVITY' | 'COMPLIANCE'; note?: string },
    @Req() req: any,
  ) {
    const userId = Number(id);
    if (isNaN(userId)) throw new BadRequestException('Invalid user');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== UserRole.RIDER) {
      throw new BadRequestException('Rider not found');
    }

    const code = String(body?.code || '').toUpperCase();
    if (!['FRAUD', 'INACTIVITY', 'COMPLIANCE'].includes(code)) {
      throw new BadRequestException('Invalid reason code');
    }

    await this.prisma.user.update(({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        riderAvailability: 'OFFLINE',
        riderReasonCode: code,
        riderReasonNote: body?.note ? String(body.note).trim() : null,
      },
    } as any));

    this.ws.notifyUser(userId, 'user.status', { status: 'SUSPENDED' });

    await this.notify.create(
      userId,
      'ACCOUNT_SUSPENDED',
      `Your rider account was suspended (${code}). Contact support.`,
      { status: 'SUSPENDED', code, note: body?.note },
      req.user?.id,
    );

    await this.audit.logAdminAction({
      userId: req.user?.id,
      action: 'RIDER_SUSPENDED',
      resource: `rider:${userId}`,
      meta: { from: user.status, to: 'SUSPENDED', code, note: body?.note },
    });

    return { success: true };
  }

  @Patch(':id/rider/resume')
  async resumeRider(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    const userId = Number(id);
    if (isNaN(userId)) throw new BadRequestException('Invalid user');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.role !== UserRole.RIDER) {
      throw new BadRequestException('Rider not found');
    }

    await this.prisma.user.update(({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        riderAvailability: 'AVAILABLE',
        riderReasonCode: null,
        riderReasonNote: null,
      },
    } as any));

    this.ws.notifyUser(userId, 'user.status', { status: 'ACTIVE' });

    await this.notify.create(
      userId,
      'ACCOUNT_RESTORED',
      'Your rider account is active again.',
      { status: 'ACTIVE', note: body?.note },
      req.user?.id,
    );

    await this.audit.logAdminAction({
      userId: req.user?.id,
      action: 'RIDER_RESUMED',
      resource: `rider:${userId}`,
      meta: { from: user.status, to: 'ACTIVE', note: body?.note },
    });

    return { success: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const userId = Number(id);
    if (isNaN(userId)) throw new BadRequestException('Invalid user');

    await this.prisma.user.delete({ where: { id: userId } });

    return { success: true };
  }
}
