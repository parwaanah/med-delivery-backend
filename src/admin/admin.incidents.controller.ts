import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
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

@Controller('admin/incidents')
@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'INCIDENTS')
export class AdminIncidentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private clampInt(v: unknown, def: number, min: number, max: number) {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, Math.floor(n)));
  }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = this.clampInt(takeRaw, 50, 1, 200);
    const s = String(status || '').trim().toUpperCase();
    const where: any = {};
    if (s) where.status = s;

    const rows = await (this.prisma as any).incident.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return { items: rows };
  }

  @Post()
  async create(
    @Req() req: any,
    @Body()
    body: {
      title?: string;
      severity?: string;
      description?: string;
      orderId?: number;
      supportTicketId?: number;
      assignedToId?: number;
    },
  ) {
    const title = String(body?.title || '').trim();
    if (!title) throw new BadRequestException('title required');

    const severity = String(body?.severity || 'SEV3').trim().toUpperCase();
    const description = String(body?.description || '').trim() || null;

    const orderId = body?.orderId != null ? Number(body.orderId) : null;
    const supportTicketId = body?.supportTicketId != null ? Number(body.supportTicketId) : null;
    const assignedToId = body?.assignedToId != null ? Number(body.assignedToId) : null;

    if (orderId != null && !Number.isFinite(orderId)) throw new BadRequestException('Invalid orderId');
    if (supportTicketId != null && !Number.isFinite(supportTicketId))
      throw new BadRequestException('Invalid supportTicketId');
    if (assignedToId != null && !Number.isFinite(assignedToId))
      throw new BadRequestException('Invalid assignedToId');

    const incident = await (this.prisma as any).incident.create({
      data: {
        title,
        severity,
        description,
        orderId,
        supportTicketId,
        createdById: Number(req.user?.id) || null,
        assignedToId,
        events: {
          create: {
            actorId: Number(req.user?.id) || null,
            type: 'COMMENT',
            message: 'Incident created',
          },
        },
      },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });

    await this.audit.logAdminAction({
      userId: Number(req.user?.id),
      action: 'INCIDENT_CREATED',
      resource: `incident:${incident.id}`,
      meta: { severity, orderId, supportTicketId, assignedToId },
    });

    return incident;
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const incidentId = Number(id);
    if (!Number.isFinite(incidentId)) throw new BadRequestException('Invalid id');
    const incident = await (this.prisma as any).incident.findUnique({
      where: { id: incidentId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        events: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!incident) throw new BadRequestException('Incident not found');
    return incident;
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      severity?: string;
      assignedToId?: number | null;
      description?: string | null;
    },
  ) {
    const incidentId = Number(id);
    if (!Number.isFinite(incidentId)) throw new BadRequestException('Invalid id');

    const patch: any = {};
    if (body?.status) {
      patch.status = String(body.status).trim().toUpperCase();
      if (patch.status === 'RESOLVED' || patch.status === 'CLOSED') {
        patch.resolvedAt = new Date();
      }
    }
    if (body?.severity) patch.severity = String(body.severity).trim().toUpperCase();
    if (body?.assignedToId !== undefined) {
      patch.assignedToId = body.assignedToId === null ? null : Number(body.assignedToId);
    }
    if (body?.description !== undefined) {
      patch.description = body.description === null ? null : String(body.description || '').trim();
    }

    const updated = await (this.prisma as any).incident.update({
      where: { id: incidentId },
      data: patch,
    });

    await (this.prisma as any).incidentEvent.create({
      data: {
        incidentId,
        actorId: Number(req.user?.id) || null,
        type: 'STATUS_CHANGE',
        message: `Incident updated`,
        meta: patch,
      },
    });

    await this.audit.logAdminAction({
      userId: Number(req.user?.id),
      action: 'INCIDENT_UPDATED',
      resource: `incident:${incidentId}`,
      meta: patch,
    });

    return updated;
  }

  @Post(':id/events')
  async postEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { message?: string; type?: string },
  ) {
    const incidentId = Number(id);
    if (!Number.isFinite(incidentId)) throw new BadRequestException('Invalid id');

    const msg = String(body?.message || '').trim();
    if (!msg) throw new BadRequestException('message required');

    const type = String(body?.type || 'COMMENT').trim().toUpperCase();

    const ev = await (this.prisma as any).incidentEvent.create({
      data: {
        incidentId,
        actorId: Number(req.user?.id) || null,
        type,
        message: msg,
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.logAdminAction({
      userId: Number(req.user?.id),
      action: 'INCIDENT_EVENT',
      resource: `incident:${incidentId}`,
      meta: { type, message: msg },
    });

    return ev;
  }
}

