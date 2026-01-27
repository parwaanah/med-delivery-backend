import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { LockService } from '../utils/lock.service';

// Backwards-compatible with older generated Prisma clients (before enum update).
const NEEDS_CONFIRMATION_STATUS = 'NEEDS_CONFIRMATION' as unknown as OrderStatus;

type Actor = { id: number; role: UserRole };

type TransitionInput = {
  orderId: number;
  actor: Actor;
  to: OrderStatus;
  event: string;
  data?: any;
  // If set, transition only from this status (unless already at `to`)
  from?: OrderStatus;
  // Optional extra fields to update atomically with status
  extraUpdate?: Record<string, any>;
  // Optional transaction client for atomic multi-write flows
  db?: Prisma.TransactionClient;
};

@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: LockService,
  ) {}

  private normalizeStatus(s: any): OrderStatus {
    if (String(s) === String(NEEDS_CONFIRMATION_STATUS))
      return NEEDS_CONFIRMATION_STATUS;
    return s as OrderStatus;
  }

  private isTerminal(s: OrderStatus) {
    return (
      s === OrderStatus.CANCELED ||
      s === OrderStatus.DELIVERED ||
      s === OrderStatus.REJECTED
    );
  }

  private canTransition(from: OrderStatus, to: OrderStatus) {
    const f = this.normalizeStatus(from);
    const t = this.normalizeStatus(to);

    if (f === t) return true; // idempotent / noop
    if (this.isTerminal(f)) return false;

    // Core lifecycle
    if (f === OrderStatus.PENDING) {
      return (
        t === OrderStatus.ACCEPTED ||
        t === OrderStatus.REJECTED ||
        t === NEEDS_CONFIRMATION_STATUS ||
        t === OrderStatus.CANCELED
      );
    }

    if (f === NEEDS_CONFIRMATION_STATUS) {
      return t === OrderStatus.ACCEPTED || t === OrderStatus.CANCELED;
    }

    if (f === OrderStatus.ACCEPTED) {
      return t === OrderStatus.ASSIGNED || t === OrderStatus.CANCELED;
    }

    if (f === OrderStatus.ASSIGNED) {
      return t === OrderStatus.REACHED_PHARMACY || t === OrderStatus.CANCELED;
    }

    if (f === OrderStatus.REACHED_PHARMACY) {
      return t === OrderStatus.PICKED_UP || t === OrderStatus.CANCELED;
    }

    if (f === OrderStatus.PICKED_UP) {
      return t === OrderStatus.OUT_FOR_DELIVERY || t === OrderStatus.CANCELED;
    }

    if (f === OrderStatus.OUT_FOR_DELIVERY) {
      return t === OrderStatus.DELIVERED || t === OrderStatus.CANCELED;
    }

    // Allow admin to force-cancel from other intermediate statuses
    if (t === OrderStatus.CANCELED) return true;

    return false;
  }

  private async logTimeline(
    db: Prisma.TransactionClient | PrismaService,
    orderId: number,
    event: string,
    data?: any,
  ) {
    try {
      await db.orderTimeline.create({
        data: {
          orderId,
          event,
          data: data ? JSON.stringify(data) : undefined,
        },
      });
    } catch (e) {
      this.logger.warn('Timeline failed', (e as any)?.message ?? e);
    }
  }

  async transition(input: TransitionInput): Promise<{ order: any; changed: boolean }> {
    const db = input.db ?? this.prisma;
    const orderId = Number(input.orderId);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid orderId');

    try {
      return await this.lock.withLock(
        `lock:order:${orderId}`,
        5000,
        async () => {
          const order = await db.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              status: true,
              customerId: true,
              pharmacyId: true,
              riderId: true,
              paymentMode: true,
              requiresPrescription: true,
              prescriptionId: true,
              totalPrice: true,
              createdAt: true,
            },
          });
          if (!order) throw new NotFoundException('Order not found');

          const current = this.normalizeStatus(order.status);
          const target = this.normalizeStatus(input.to);

          // Idempotent success
          if (String(current) === String(target)) {
            return { order, changed: false };
          }

          if (
            input.from &&
            String(current) !== String(this.normalizeStatus(input.from))
          ) {
            throw new BadRequestException(
              `Invalid transition (expected ${input.from}, got ${current})`,
            );
          }

          if (!this.canTransition(current, target)) {
            throw new BadRequestException(
              `Invalid transition ${current} -> ${target}`,
            );
          }

          const update: any = { status: target };
          if (input.extraUpdate && typeof input.extraUpdate === 'object') {
            Object.assign(update, input.extraUpdate);
          }

          const res = await db.order.updateMany({
            where: { id: orderId, status: order.status as any },
            data: update,
          });

          if (!res || (res as any).count !== 1) {
            const after = await db.order.findUnique({
              where: { id: orderId },
              select: {
                id: true,
                status: true,
                customerId: true,
                pharmacyId: true,
                riderId: true,
              },
            });
            if (!after) throw new NotFoundException('Order not found');
            if (String(this.normalizeStatus(after.status)) === String(target)) {
              return { order: after, changed: false };
            }
            throw new ConflictException('Order status changed; please retry');
          }

          await this.logTimeline(db, orderId, input.event, {
            actor: { id: input.actor.id, role: input.actor.role },
            from: String(current),
            to: String(target),
            ...(input.data || {}),
          });

          const updated = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true, prescription: true },
          });

          return { order: updated, changed: true };
        },
        { waitMs: 50, retries: 40 },
      );
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.startsWith('LOCK_BUSY:')) {
        throw new ConflictException('Order is busy; please retry');
      }
      throw e;
    }
  }

  /**
   * Admin-only override: sets status without enforcing the state machine.
   * Still idempotent + emits a timeline event (single source of truth).
   */
  async forceStatus(input: Omit<TransitionInput, 'from'> & { from?: OrderStatus }) {
    const db = (input as any).db ?? this.prisma;
    const orderId = Number(input.orderId);
    if (!Number.isFinite(orderId)) throw new BadRequestException('Invalid orderId');

    try {
      return await this.lock.withLock(
        `lock:order:${orderId}`,
        5000,
        async () => {
          const order = await db.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              status: true,
              customerId: true,
              pharmacyId: true,
              riderId: true,
            },
          });
          if (!order) throw new NotFoundException('Order not found');

          const current = this.normalizeStatus(order.status);
          const target = this.normalizeStatus(input.to);

          if (String(current) === String(target)) {
            return { order, changed: false };
          }

          const update: any = { status: target };
          if (
            (input as any).extraUpdate &&
            typeof (input as any).extraUpdate === 'object'
          ) {
            Object.assign(update, (input as any).extraUpdate);
          }

          const res = await db.order.updateMany({
            where: { id: orderId, status: order.status as any },
            data: update,
          });

          if (!res || (res as any).count !== 1) {
            const after = await db.order.findUnique({
              where: { id: orderId },
              select: {
                id: true,
                status: true,
                customerId: true,
                pharmacyId: true,
                riderId: true,
              },
            });
            if (!after) throw new NotFoundException('Order not found');
            if (String(this.normalizeStatus(after.status)) === String(target)) {
              return { order: after, changed: false };
            }
            throw new ConflictException('Order status changed; please retry');
          }

          await this.logTimeline(db, orderId, input.event, {
            actor: { id: input.actor.id, role: input.actor.role },
            from: String(current),
            to: String(target),
            force: true,
            ...(input.data || {}),
          });

          const updated = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true, prescription: true },
          });

          return { order: updated, changed: true };
        },
        { waitMs: 50, retries: 40 },
      );
    } catch (e: any) {
      if (typeof e?.message === 'string' && e.message.startsWith('LOCK_BUSY:')) {
        throw new ConflictException('Order is busy; please retry');
      }
      throw e;
    }
  }
}
