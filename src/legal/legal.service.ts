import { Injectable } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';

export type LegalConfig = {
  required: boolean;
  version: string;
  termsUrl: string | null;
  privacyUrl: string | null;
};

@Injectable()
export class LegalService {
  constructor(private prisma: PrismaService) {}

  getConfig(): LegalConfig {
    const required = String(process.env.CONSENT_REQUIRED || '')
      .trim()
      .toLowerCase() === 'true';
    const version = String(process.env.TERMS_VERSION || 'v1').trim() || 'v1';
    const termsUrlRaw = String(process.env.TERMS_URL || '').trim();
    const privacyUrlRaw = String(process.env.PRIVACY_URL || '').trim();

    return {
      required,
      version,
      termsUrl: termsUrlRaw || null,
      privacyUrl: privacyUrlRaw || null,
    };
  }

  async hasAccepted(userId: number, version: string) {
    const row = await (this.prisma as any).termsAcceptance.findUnique({
      where: { userId_version: { userId, version } },
      select: { acceptedAt: true },
    });
    return row ? { accepted: true, acceptedAt: row.acceptedAt } : { accepted: false, acceptedAt: null };
  }

  async accept(userId: number, version: string, meta: { ip?: string | null; userAgent?: string | null }) {
    const ip = meta?.ip ? String(meta.ip).slice(0, 128) : null;
    const userAgent = meta?.userAgent ? String(meta.userAgent).slice(0, 512) : null;

    const row = await (this.prisma as any).termsAcceptance.upsert({
      where: { userId_version: { userId, version } },
      update: { acceptedAt: new Date(), ip, userAgent },
      create: { userId, version, acceptedAt: new Date(), ip, userAgent },
      select: { acceptedAt: true, version: true },
    });

    return row;
  }
}
