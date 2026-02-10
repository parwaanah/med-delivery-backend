import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../utils/prisma.service';
import { UserRole } from '@prisma/client';
import { FcmService } from '../utils/fcm.service';

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/mobile/promotions')
export class AdminMobilePromotionsController {
  constructor(
    private prisma: PrismaService,
    private fcm: FcmService,
  ) {}

  /**
   * Sends a promotion push to customers who have device tokens registered and did not disable promotions.
   *
   * Note: This is a best-effort utility endpoint. For large-scale sends, move this to a queue/worker.
   */
  @Post('send')
  async sendPromotion(
    @Body()
    body: {
      title: string;
      body: string;
      deepLink?: string | null;
      audience?: 'CUSTOMERS' | 'ALL';
      dryRun?: boolean;
    },
  ) {
    const title = String(body?.title || '').trim();
    const message = String(body?.body || '').trim();
    const deepLink = body?.deepLink != null ? String(body.deepLink).trim() : null;
    const audience = (String(body?.audience || 'CUSTOMERS').trim().toUpperCase() ||
      'CUSTOMERS') as 'CUSTOMERS' | 'ALL';
    const dryRun = body?.dryRun === true;

    if (!title || !message) {
      return { ok: false, error: 'title and body are required' };
    }

    // Pick users (default: customers).
    const users = await this.prisma.user.findMany({
      where:
        audience === 'ALL'
          ? { role: { in: [UserRole.CUSTOMER, UserRole.ADMIN] } }
          : { role: UserRole.CUSTOMER },
      select: { id: true },
      take: 5000, // safety cap
    });
    const userIds = users.map((u) => u.id);

    // Load prefs + tokens in a single query path.
    // We treat missing preference row as enabled (default).
    const deviceTokens = await (this.prisma as any).deviceToken.findMany({
      where: {
        enabled: true,
        userId: { in: userIds },
        user: {
          OR: [
            { notificationPreference: null },
            { notificationPreference: { promotions: { not: false } } },
          ],
        },
      },
      select: { token: true },
      take: 25_000, // safety cap
    });

    const tokens: string[] = Array.from(
      new Set<string>(
        deviceTokens.map((t: any) => String(t.token || '').trim()).filter(Boolean),
      ),
    );

    if (dryRun) {
      return { ok: true, dryRun: true, users: userIds.length, tokens: tokens.length };
    }

    const batches: string[][] = chunk(tokens, 800);
    const results = [];
    for (const b of batches) {
      // Ensure promotions channel for Android controls.
      // Client uses this id to map into Android notification channels.
      const res = await this.fcm.sendToTokens(b, {
        title,
        body: message,
        androidChannelId: 'promotions',
        data: deepLink ? { deepLink } : {},
      });
      results.push(res);
    }

    return {
      ok: true,
      users: userIds.length,
      tokens: tokens.length,
      batches: batches.length,
      results,
    };
  }
}
