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

const DEFAULT_MOBILE_TABS = [
  { key: 'index', title: 'Home', icon: 'home-outline', enabled: true },
  { key: 'orders', title: 'Orders', icon: 'file-tray-outline', enabled: true },
  { key: 'lab', title: 'Lab Test', icon: 'flask-outline', enabled: true },
  { key: 'cart', title: 'Cart', icon: 'cart-outline', enabled: true },
  { key: 'offers', title: 'Offers', icon: 'pricetag-outline', enabled: true },
  { key: 'profile', title: 'Profile', icon: 'person-outline', enabled: true },
] as const;

type MobileTabKey = (typeof DEFAULT_MOBILE_TABS)[number]['key'];

function normalizeMobileTabsForAdmin(value: any) {
  // Backward compatible: { tabs: string[] }
  const legacy = value && typeof value === 'object' ? (value as any).tabs : null;
  if (Array.isArray(legacy) && legacy.every((t) => typeof t === 'string')) {
    const allowed = new Set(DEFAULT_MOBILE_TABS.map((t) => t.key));
    const enabled = new Set(
      Array.from(new Set(legacy.map((t) => String(t).trim()))).filter((t) => allowed.has(t as any)),
    );
    return DEFAULT_MOBILE_TABS.map((t) => ({ ...t, enabled: enabled.has(t.key) }));
  }

  const tabs = value && typeof value === 'object' ? (value as any).tabs : null;
  if (!Array.isArray(tabs)) return DEFAULT_MOBILE_TABS.slice();

  const allowed = new Set(DEFAULT_MOBILE_TABS.map((t) => t.key));
  const seen = new Set<string>();
  const out: Array<{ key: MobileTabKey; title: string; icon: string; enabled: boolean }> = [];

  for (const raw of tabs) {
    const key = String((raw as any)?.key || '').trim() as MobileTabKey;
    if (!allowed.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    const fallback = DEFAULT_MOBILE_TABS.find((t) => t.key === key)!;
    const title = typeof (raw as any)?.title === 'string' ? String((raw as any).title).trim() : '';
    const icon = typeof (raw as any)?.icon === 'string' ? String((raw as any).icon).trim() : '';
    const enabled = (raw as any)?.enabled !== false;

    out.push({
      key,
      title: title || fallback.title,
      icon: icon || fallback.icon,
      enabled,
    });
  }

  const byKey = new Map(out.map((t) => [t.key, t]));
  return DEFAULT_MOBILE_TABS.map((d) => byKey.get(d.key) || { ...d, enabled: false });
}

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
    const tabs = normalizeMobileTabsForAdmin(row?.value);
    return { tabs, updatedAt: row?.updatedAt || null };
  }

  @Put('mobile-tabs')
  async setMobileTabs(
    @Body()
    body:
      | { tabs?: string[] }
      | {
          tabs?: Array<{
            key?: string;
            title?: string;
            icon?: string;
            enabled?: boolean;
          }>;
        },
  ) {
    const allowed = new Set(DEFAULT_MOBILE_TABS.map((t) => t.key));

    // Accept legacy string[]
    const legacy = (body as any)?.tabs;
    if (Array.isArray(legacy) && legacy.every((t) => typeof t === 'string')) {
      const enabled = Array.from(new Set(legacy.map((t) => String(t).trim()))).filter((t) =>
        allowed.has(t as any),
      );
      const next = DEFAULT_MOBILE_TABS.map((t) => ({ ...t, enabled: enabled.includes(t.key) }));
      const row = await this.appConfig.setConfig('mobileTabs', { tabs: next });
      return { ok: true, tabs: normalizeMobileTabsForAdmin(row.value), updatedAt: row.updatedAt };
    }

    const tabsRaw = Array.isArray((body as any)?.tabs) ? (body as any).tabs : [];
    const seen = new Set<string>();
    const out: Array<{ key: MobileTabKey; title: string; icon: string; enabled: boolean }> = [];

    for (const raw of tabsRaw) {
      const key = String(raw?.key || '').trim() as MobileTabKey;
      if (!allowed.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const fallback = DEFAULT_MOBILE_TABS.find((t) => t.key === key)!;
      const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
      const icon = typeof raw?.icon === 'string' ? raw.icon.trim() : '';
      const enabled = raw?.enabled !== false;

      out.push({
        key,
        title: title || fallback.title,
        icon: icon || fallback.icon,
        enabled,
      });
    }

    const byKey = new Map(out.map((t) => [t.key, t]));
    const next = DEFAULT_MOBILE_TABS.map((d) => byKey.get(d.key) || { ...d, enabled: false });

    const row = await this.appConfig.setConfig('mobileTabs', { tabs: next });
    return { ok: true, tabs: normalizeMobileTabsForAdmin(row.value), updatedAt: row.updatedAt };
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
