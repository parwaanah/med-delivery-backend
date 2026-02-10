import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { Cron } from '@nestjs/schedule';

const PRESCRIPTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Marks prescriptions as EXPIRED when their `expiresAt` is in the past.
   * Runs periodically so clients can rely on a real persisted status.
   */
  @Cron('0 */15 * * * *')
  async expireOverdue() {
    const now = new Date();

    try {
      const res = await (this.prisma as any).prescription.updateMany({
        where: {
          expiresAt: { not: null, lt: now },
          status: { in: [PRESCRIPTION_STATUS.PENDING, PRESCRIPTION_STATUS.APPROVED] },
        },
        data: { status: PRESCRIPTION_STATUS.EXPIRED },
      });

      if (res.count > 0) {
        this.logger.debug(`Expired ${res.count} prescription(s)`);
      }
    } catch (e) {
      // Non-fatal: don't crash the server if the job fails.
      this.logger.warn('Prescription expiry job failed', (e as any)?.message ?? e);
    }
  }

  async listForCustomer(customerId: number) {
    if (!Number.isFinite(customerId)) throw new BadRequestException('Invalid customer');

    return (this.prisma as any).prescription.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        url: true,
        status: true,
        verified: true,
        verifiedAt: true,
        rejectedAt: true,
        rejectedReason: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async getForCustomer(customerId: number, id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid prescription');
    const row = await (this.prisma as any).prescription.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        url: true,
        status: true,
        verified: true,
        verifiedAt: true,
        rejectedAt: true,
        rejectedReason: true,
        expiresAt: true,
        createdAt: true,
        orders: { select: { id: true, status: true, createdAt: true } },
      },
    });
    if (!row || row.customerId !== customerId) throw new NotFoundException('Prescription not found');
    return row;
  }

  async updateForCustomer(customerId: number, id: number, input: { url?: string }) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid prescription');
    const url = typeof input?.url === 'string' ? input.url.trim() : '';
    if (!url) throw new BadRequestException('url is required');

    const row = await (this.prisma as any).prescription.findUnique({
      where: { id },
      select: { id: true, customerId: true, status: true },
    });
    if (!row || row.customerId !== customerId) throw new NotFoundException('Prescription not found');

    // "Replace" flow: reset lifecycle back to PENDING and clear any review metadata.
    return (this.prisma as any).prescription.update({
      where: { id },
      data: {
        url,
        status: PRESCRIPTION_STATUS.PENDING,
        verified: false,
        verifiedAt: null,
        rejectedAt: null,
        rejectedReason: null,
        expiresAt: null,
      },
      select: {
        id: true,
        url: true,
        status: true,
        verified: true,
        verifiedAt: true,
        rejectedAt: true,
        rejectedReason: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }
}
