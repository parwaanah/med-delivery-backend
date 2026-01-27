import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { NotificationService } from '../utils/notification.service';
import { UserRole } from '@prisma/client';

type TicketStatus = 'OPEN' | 'PENDING_ADMIN' | 'PENDING_USER' | 'RESOLVED' | 'CLOSED';
type MessageType = 'USER' | 'ADMIN' | 'INTERNAL';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
  ) {}

  private async adminIds(): Promise<number[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null as any },
      select: { id: true },
    } as any);
    return admins.map((a) => Number(a.id)).filter((n) => Number.isFinite(n));
  }

  private async notifyAdmins(eventName: string, message: string, payload: any, senderId?: number) {
    const ids = await this.adminIds();
    await Promise.all(
      ids.map((adminId) =>
        this.notify.createDomainEvent(adminId, eventName, message, payload, senderId),
      ),
    );
  }

  async createTicket(
    requesterId: number,
    requesterRole: string,
    body: { subject: string; message: string; orderId?: number; attachments?: string[] },
  ) {
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const orderId = body.orderId != null ? Number(body.orderId) : null;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!subject) throw new BadRequestException('Subject required');
    if (!message) throw new BadRequestException('Message required');
    if (orderId != null && !Number.isFinite(orderId)) throw new BadRequestException('Invalid orderId');

    if (orderId != null) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true, pharmacyId: true, riderId: true },
      } as any);
      if (!order) throw new BadRequestException('Order not found');

      const r = String(requesterRole || '').toUpperCase();
      const allowed =
        (r === 'CUSTOMER' && Number(order.customerId) === requesterId) ||
        (r === 'PHARMACY' && Number(order.pharmacyId) === requesterId) ||
        (r === 'RIDER' && Number(order.riderId) === requesterId) ||
        r === 'ADMIN';
      if (!allowed) throw new ForbiddenException('Not allowed to link this order');
    }

    const ticket = await (this.prisma as any).supportTicket.create({
      data: {
        requesterId,
        orderId: orderId ?? null,
        subject,
        status: 'OPEN',
        messages: {
          create: {
            senderId: requesterId,
            type: 'USER',
            message,
            attachments: attachments.length ? attachments : undefined,
          },
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    await this.notifyAdmins(
      'support.ticket.created',
      `New support ticket #${ticket.id}`,
      { ticketId: ticket.id, requesterId, orderId: ticket.orderId },
      requesterId,
    );

    return ticket;
  }

  async listForRequester(requesterId: number) {
    return (this.prisma as any).supportTicket.findMany({
      where: { requesterId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        subject: true,
        status: true,
        orderId: true,
        assignedAdminId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getForRequester(requesterId: number, ticketId: number) {
    const ticket = await (this.prisma as any).supportTicket.findFirst({
      where: { id: ticketId, requesterId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async postMessageFromRequester(
    requesterId: number,
    ticketId: number,
    message: string,
    attachments?: string[],
  ) {
    const text = String(message || '').trim();
    if (!text) throw new BadRequestException('Message required');
    const atts = Array.isArray(attachments) ? attachments : [];

    const ticket = await (this.prisma as any).supportTicket.findFirst({
      where: { id: ticketId, requesterId },
      select: { id: true, status: true, assignedAdminId: true, requesterId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (String(ticket.status) === 'CLOSED') {
      throw new BadRequestException('Ticket is closed');
    }

    await (this.prisma as any).supportMessage.create({
      data: {
        ticketId,
        senderId: requesterId,
        type: 'USER',
        message: text,
        attachments: atts.length ? atts : undefined,
      },
    });

    await (this.prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: { status: 'PENDING_ADMIN' },
    });

    await this.notifyAdmins(
      'support.message.new',
      `New customer message on ticket #${ticketId}`,
      { ticketId },
      requesterId,
    );

    return { ok: true };
  }

  async closeTicket(requesterId: number, ticketId: number) {
    const ticket = await (this.prisma as any).supportTicket.findFirst({
      where: { id: ticketId, requesterId },
      select: { id: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (String(ticket.status) === 'CLOSED') return { ok: true };

    await (this.prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    });

    await this.notifyAdmins(
      'support.ticket.updated',
      `Ticket #${ticketId} closed`,
      { ticketId, status: 'CLOSED' },
      requesterId,
    );

    return { ok: true };
  }

  // ---------------- ADMIN ----------------

  async adminList(status?: TicketStatus) {
    const where: any = {};
    if (status) where.status = status;

    return (this.prisma as any).supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true, email: true, phone: true, role: true } },
      },
      take: 200,
    });
  }

  async adminGet(ticketId: number) {
    const ticket = await (this.prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        requester: { select: { id: true, name: true, email: true, phone: true, role: true } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async adminUpdateTicket(
    adminId: number,
    ticketId: number,
    patch: { status?: TicketStatus; assignedAdminId?: number },
  ) {
    const existing = await (this.prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true, status: true, assignedAdminId: true },
    });
    if (!existing) throw new NotFoundException('Ticket not found');

    const next: any = {};
    if (patch.status) next.status = patch.status;
    if (patch.assignedAdminId != null) next.assignedAdminId = Number(patch.assignedAdminId);

    const updated = await (this.prisma as any).supportTicket.update({
      where: { id: ticketId },
      data: next,
    });

    await this.notify.createDomainEvent(
      existing.requesterId,
      'support.ticket.updated',
      `Support ticket #${ticketId} updated`,
      { ticketId, status: updated.status },
      adminId,
    );

    return updated;
  }

  async adminPostMessage(
    adminId: number,
    ticketId: number,
    message: string,
    internal?: boolean,
    attachments?: string[],
  ) {
    const text = String(message || '').trim();
    if (!text) throw new BadRequestException('Message required');
    const atts = Array.isArray(attachments) ? attachments : [];

    const ticket = await (this.prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true, status: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const type: MessageType = internal ? 'INTERNAL' : 'ADMIN';

    await (this.prisma as any).supportMessage.create({
      data: {
        ticketId,
        senderId: adminId,
        type,
        message: text,
        attachments: atts.length ? atts : undefined,
      },
    });

    if (!internal) {
      await (this.prisma as any).supportTicket.update({
        where: { id: ticketId },
        data: { status: 'PENDING_USER' },
      });

      await this.notify.createDomainEvent(
        ticket.requesterId,
        'support.message.new',
        `New message on support ticket #${ticketId}`,
        { ticketId },
        adminId,
      );
    }

    return { ok: true };
  }
}
