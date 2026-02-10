import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AppConfigService } from '../app-config/app-config.service';
import { CloudinaryService } from '../uploads/cloudinary.service';

function toIsoOrNull(v: any) {
  if (v == null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function resolveActiveBanner(value: any) {
  if (!value || typeof value !== 'object') return { url: null };
  if (typeof (value as any).url === 'string') return { url: String((value as any).url).trim() || null };

  const banners = Array.isArray((value as any).banners) ? (value as any).banners : null;
  if (!banners) return { url: null };

  const now = Date.now();
  const candidates = banners
    .map((b: any) => ({
      url: typeof b?.url === 'string' ? b.url.trim() : '',
      enabled: b?.enabled !== false,
      startsAt: b?.startsAt ? new Date(b.startsAt).getTime() : null,
      endsAt: b?.endsAt ? new Date(b.endsAt).getTime() : null,
    }))
    .filter((b: any) => Boolean(b.url) && b.enabled)
    .filter((b: any) => (b.startsAt == null || b.startsAt <= now) && (b.endsAt == null || b.endsAt >= now))
    .sort((a: any, c: any) => (c.startsAt ?? 0) - (a.startsAt ?? 0));

  return { url: candidates[0]?.url ?? null };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/app-config')
export class AdminAppConfigController {
  constructor(
    private appConfig: AppConfigService,
    private cloud: CloudinaryService,
  ) {}

  @Get('hero-banner')
  async getHeroBanner() {
    const row = await this.appConfig.getConfig('heroBanner');
    const url = resolveActiveBanner(row?.value).url;
    return { value: row?.value ?? null, url, updatedAt: row?.updatedAt || null };
  }

  @Put('hero-banner')
  async setHeroBanner(@Body() body: { url?: string; banners?: any[] }) {
    // Backward compatible: accept single URL
    if (body?.url !== undefined) {
      const url = typeof body?.url === 'string' ? body.url.trim() : '';
      const value = url ? { url } : { url: null };
      const row = await this.appConfig.setConfig('heroBanner', value);
      return {
        ok: true,
        value: row.value,
        url: resolveActiveBanner(row.value).url,
        updatedAt: row.updatedAt,
      };
    }

    const bannersRaw = Array.isArray(body?.banners) ? body.banners : [];
    const banners = bannersRaw
      .map((b) => ({
        url: typeof b?.url === 'string' ? b.url.trim() : '',
        enabled: b?.enabled !== false,
        startsAt: toIsoOrNull(b?.startsAt),
        endsAt: toIsoOrNull(b?.endsAt),
      }))
      .filter((b) => Boolean(b.url));

    for (const b of banners) {
      if (b.startsAt && b.endsAt && new Date(b.startsAt) > new Date(b.endsAt)) {
        throw new BadRequestException('Banner startsAt must be <= endsAt');
      }
    }

    const row = await this.appConfig.setConfig('heroBanner', { banners });
    return {
      ok: true,
      value: row.value,
      url: resolveActiveBanner(row.value).url,
      updatedAt: row.updatedAt,
    };
  }

  @Post('hero-banner/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024) },
    }),
  )
  async uploadHeroBannerImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File required');
    if (!file.buffer) throw new BadRequestException('File buffer missing');

    const allowed = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    const uploaded = await this.cloud.uploadBuffer(file.buffer, 'mobile_banners');
    return { url: uploaded.secure_url, publicId: uploaded.public_id };
  }

  @Get('mobile-tabs')
  async getMobileTabs() {
    const row = await this.appConfig.getConfig('mobileTabs');
    const tabs =
      row && typeof row.value === 'object' && row.value
        ? (row.value as any).tabs || null
        : null;
    return { tabs, updatedAt: row?.updatedAt || null };
  }

  @Put('mobile-tabs')
  async setMobileTabs(@Body() body: { tabs?: string[] }) {
    const allowed = new Set(['index', 'cart', 'orders', 'lab', 'offers', 'profile']);
    const tabs = Array.isArray(body?.tabs)
      ? body.tabs
          .map((t) => String(t).trim())
          .filter((t) => allowed.has(t))
      : [];
    const unique = Array.from(new Set(tabs));
    const row = await this.appConfig.setConfig('mobileTabs', { tabs: unique });
    return { ok: true, tabs: (row.value as any)?.tabs || [], updatedAt: row.updatedAt };
  }

  @Get('mobile-categories')
  async getMobileCategories() {
    const row = await this.appConfig.getConfig('mobileCategories');
    const categories =
      row && typeof row.value === 'object' && row.value
        ? (row.value as any).categories || null
        : null;
    return { categories, updatedAt: row?.updatedAt || null };
  }

  @Put('mobile-categories')
  async setMobileCategories(
    @Body()
    body: {
      categories?: Array<{
        key?: string;
        label?: string;
        icon?: string;
        enabled?: boolean;
      }>;
    },
  ) {
    const categoriesRaw = Array.isArray(body?.categories) ? body.categories : [];
    const categories = categoriesRaw
      .map((c) => ({
        key: String(c?.key || '').trim(),
        label: String(c?.label || '').trim(),
        icon: c?.icon != null ? String(c.icon).trim() : null,
        enabled: c?.enabled !== false,
      }))
      .filter((c) => Boolean(c.key) && Boolean(c.label));

    // Deduplicate by key (keep first)
    const seen = new Set<string>();
    const unique = categories.filter((c) => {
      const k = c.key.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const row = await this.appConfig.setConfig('mobileCategories', { categories: unique });
    return { ok: true, categories: (row.value as any)?.categories || [], updatedAt: row.updatedAt };
  }
}
