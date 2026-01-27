import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationService } from '../utils/notification.service';
import { AuditService } from '../utils/audit.service';
import { UserRole } from '@prisma/client';
import { LockService } from '../utils/lock.service';

type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notify: NotificationService,
    private readonly audit: AuditService,
    private readonly lock: LockService,
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

  async requestRefund(
    customerId: number,
    orderId: number,
    body: { amount?: number; reason?: string },
  ) {
    return this.lock.withLock(`lock:refundreq:${orderId}`, 6000, async () => {
      const order: any = await this.prisma.order.findUnique(({
        where: { id: orderId },
        select: {
          id: true,
          customerId: true,
          pharmacyId: true,
          paymentStatus: true,
          status: true,
        },
      } as any));
      if (!order) throw new NotFoundException('Order not found');
      if (Number(order.customerId) !== Number(customerId)) {
        throw new ForbiddenException('Not your order');
      }

      const pay = String(order.paymentStatus || 'UNPAID').toUpperCase();
      if (pay !== 'PAID') {
        throw new BadRequestException('Refunds can only be requested for paid orders');
      }

      const existing = await (this.prisma as any).refundRequest.findFirst({
        where: { orderId, requestedById: customerId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return { ok: true, request: existing, already: true };

      const tx = await this.prisma.transaction.findFirst({
        where: { orderId, status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
      });
      if (!tx) {
        throw new BadRequestException('No successful transaction found for this order');
      }

      const amount = body?.amount != null ? Number(body.amount) : undefined;
      if (amount != null) {
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new BadRequestException('Invalid refund amount');
        }
        const max = Number(tx.amount) / 100;
        if (amount > max) throw new BadRequestException(`Amount exceeds charged amount (${max})`);
      }

      const reason = String(body?.reason || '').trim() || null;

      const request = await (this.prisma as any).refundRequest.create({
        data: {
          orderId,
          transactionId: tx.id,
          requestedById: customerId,
          status: 'PENDING',
          requestedAmount: amount != null ? Number(amount) : null,
          reason,
        },
      });

      await this.notifyAdmins(
        'refund.requested',
        `Refund requested for order #${orderId}`,
        { refundRequestId: request.id, orderId, transactionId: tx.id, requestedById: customerId },
        customerId,
      );

      await this.notify.createDomainEvent(
        customerId,
        'refund.requested',
        `Refund request created for order #${orderId}`,
        { refundRequestId: request.id, orderId, transactionId: tx.id },
      );

      return { ok: true, request };
    });
  }

  async listMyRequests(customerId: number) {
    const rows = await (this.prisma as any).refundRequest.findMany({
      where: { requestedById: customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, status: true, paymentStatus: true, totalPrice: true } },
      },
      take: 200,
    });
    return { items: rows };
  }

  async adminList(opts: { status?: string }) {
    const status = String(opts?.status || '').trim().toUpperCase();
    const where: any = {};
    if (status) where.status = status as RefundStatus;

    const rows = await (this.prisma as any).refundRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { id: true, status: true, paymentStatus: true, totalPrice: true } },
        requestedBy: { select: { id: true, name: true, email: true, phone: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      take: 500,
    });
    return { items: rows };
  }

  async adminGet(id: number) {
    const row = await (this.prisma as any).refundRequest.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, status: true, paymentStatus: true, totalPrice: true } },
        requestedBy: { select: { id: true, name: true, email: true, phone: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        transaction: true,
      },
    });
    if (!row) throw new NotFoundException('Refund request not found');
    return row;
  }

  async adminApprove(
    id: number,
    adminId: number,
    body: { amount?: number; note?: string },
  ) {
    return this.lock.withLock(`lock:refundreq:${id}`, 10_000, async () => {
      const row = await (this.prisma as any).refundRequest.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Refund request not found');

      const status = String(row.status || '').toUpperCase();
      if (status === 'APPROVED') return { ok: true, already: true, request: row };
      if (status !== 'PENDING') throw new BadRequestException(`Cannot approve in status ${row.status}`);

      const amount = body?.amount != null ? Number(body.amount) : undefined;
      const note = String(body?.note || '').trim() || null;

      // Triggers timeline + notifications via PaymentsService
      const refundRes = await this.payments.refundTransaction(
        String(row.transactionId),
        amount,
        adminId,
      );

      const updated = await (this.prisma as any).refundRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAmount: amount != null ? Number(amount) : null,
          adminNote: note,
          approvedById: adminId,
          resolvedAt: new Date(),
        },
      });

      await this.audit.logAdminAction({
        userId: adminId,
        action: 'REFUND_REQUEST_APPROVED',
        resource: `refundRequest:${id}`,
        meta: {
          orderId: updated.orderId,
          transactionId: updated.transactionId,
          amount,
          note,
        },
      });

      // Also notify requester explicitly (payment.refunded already emitted too)
      await this.notify.createDomainEvent(
        Number(updated.requestedById),
        'refund.approved',
        `Refund approved for order #${updated.orderId}`,
        {
          refundRequestId: updated.id,
          orderId: updated.orderId,
          transactionId: updated.transactionId,
          amount: amount ?? null,
        },
        adminId,
      );

      return { ok: true, request: updated, refund: refundRes };
    });
  }

  async adminReject(id: number, adminId: number, body: { note?: string }) {
    return this.lock.withLock(`lock:refundreq:${id}`, 6000, async () => {
      const row = await (this.prisma as any).refundRequest.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Refund request not found');

      const status = String(row.status || '').toUpperCase();
      if (status === 'REJECTED') return { ok: true, already: true, request: row };
      if (status !== 'PENDING') throw new BadRequestException(`Cannot reject in status ${row.status}`);

      const note = String(body?.note || '').trim() || null;

      const updated = await (this.prisma as any).refundRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: note,
          approvedById: adminId,
          resolvedAt: new Date(),
        },
      });

      await this.audit.logAdminAction({
        userId: adminId,
        action: 'REFUND_REQUEST_REJECTED',
        resource: `refundRequest:${id}`,
        meta: { orderId: updated.orderId, note },
      });

      await this.notify.createDomainEvent(
        Number(updated.requestedById),
        'refund.rejected',
        `Refund request rejected for order #${updated.orderId}`,
        { refundRequestId: updated.id, orderId: updated.orderId, note },
        adminId,
      );

      return { ok: true, request: updated };
    });
  }
}
