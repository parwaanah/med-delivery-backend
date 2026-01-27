import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SupportService } from './support.service';
import { AdminPostMessageDto } from './dto/admin-post-message.dto';
import { AdminUpdateTicketDto } from './dto/admin-update-ticket.dto';
import { AdminPerms } from '../common/decorators/admin-perms.decorator';
import { AdminPermsGuard } from '../common/guards/admin-perms.guard';

@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard, AdminPermsGuard)
@Roles(UserRole.ADMIN)
@AdminPerms('SUPERADMIN', 'SUPPORT')
export class AdminSupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  list(@Query('status') status?: string) {
    const s = status ? String(status).toUpperCase() : '';
    const parsed = ['OPEN', 'PENDING_ADMIN', 'PENDING_USER', 'RESOLVED', 'CLOSED'].includes(s)
      ? (s as any)
      : undefined;
    return this.support.adminList(parsed);
  }

  @Get('tickets/:id')
  get(@Param('id') id: string) {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) throw new BadRequestException('Invalid ticket id');
    return this.support.adminGet(ticketId);
  }

  @Patch('tickets/:id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: AdminUpdateTicketDto) {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) throw new BadRequestException('Invalid ticket id');
    return this.support.adminUpdateTicket(Number(req.user?.id), ticketId, dto as any);
  }

  @Post('tickets/:id/messages')
  postMessage(@Req() req: any, @Param('id') id: string, @Body() dto: AdminPostMessageDto) {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) throw new BadRequestException('Invalid ticket id');
    return this.support.adminPostMessage(
      Number(req.user?.id),
      ticketId,
      dto.message,
      Boolean(dto.internal),
      dto.attachments as any,
    );
  }
}
