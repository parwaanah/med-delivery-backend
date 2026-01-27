import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PostMessageDto } from './dto/post-message.dto';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.PHARMACY, UserRole.RIDER)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  list(@Req() req: any) {
    return this.support.listForRequester(Number(req.user?.id));
  }

  @Post('tickets')
  create(@Req() req: any, @Body() dto: CreateTicketDto) {
    return this.support.createTicket(Number(req.user?.id), String(req.user?.role), dto as any);
  }

  @Get('tickets/:id')
  get(@Req() req: any, @Param('id') id: string) {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) throw new BadRequestException('Invalid ticket id');
    return this.support.getForRequester(Number(req.user?.id), ticketId);
  }

  @Post('tickets/:id/messages')
  postMessage(@Req() req: any, @Param('id') id: string, @Body() dto: PostMessageDto) {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) throw new BadRequestException('Invalid ticket id');
    return this.support.postMessageFromRequester(
      Number(req.user?.id),
      ticketId,
      dto.message,
      dto.attachments as any,
    );
  }

  @Patch('tickets/:id/close')
  close(@Req() req: any, @Param('id') id: string) {
    const ticketId = Number(id);
    if (!Number.isFinite(ticketId)) throw new BadRequestException('Invalid ticket id');
    return this.support.closeTicket(Number(req.user?.id), ticketId);
  }
}
