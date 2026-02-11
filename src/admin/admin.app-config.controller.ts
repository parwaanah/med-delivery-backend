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
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AppConfigService } from '../app-config/app-config.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AuditService } from '../utils/audit.service';

const DEFAULT_MOBILE_TABS = [
  { key: 'index', title: 'Home', icon: 'home-outline', enabled: true },
  { key: 'orders', title: 'Orders', icon: 'file-tray-outline', enabled: true },
  { key: 'lab', title: 'Lab Test', icon: 'flask-outline', enabled: true },
  { key: 'cart', title: 'Cart', icon: 'cart-outline', enabled: true },
  { key: 'offers', title: 'Offers', icon: 'pricetag-outline', enabled: true },
  { key: 'profile', title: 'Profile', icon: 'person-outline', enabled: true },
] as const;

type MobileTabKey = (typeof DEFAULT_MOBILE_TABS)[number]['key'];
type MobileIconPack = 'ion' | 'mci';

function normalizeIconRef(raw: any): { pack: MobileIconPack; name: string } | null {
  // Preferred: { pack, name }
  if (raw && typeof raw === 'object') {
    const pack = String((raw as any).pack || '').trim().toLowerCase();
    const name = String((raw as any).name || '').trim();
    if ((pack === 'ion' || pack === 'mci') && name) return { pack: pack as MobileIconPack, name };
  }

  // Legacy: "ion:medkit-outline" | "mci:pill"
  if (typeof raw === 'string') {
    const v = raw.trim();
    const m = /^(ion|mci)\s*:\s*(.+)$/i.exec(v);
    if (m) {
      const pack = m[1].toLowerCase() as MobileIconPack;
      const name = String(m[2] || '').trim();
      if (name) return { pack, name };
    }
  }

  return null;
}

function normalizeMobileCategoriesForAdmin(value: any) {
  const categories = value && typeof value === 'object' && value ? (value as any).categories : null;
  if (!Array.isArray(categories)) return [];

  const seen = new Set<string>();
  const out: Array<{
    key: string;
    label: string;
    icon: { pack: MobileIconPack; name: string } | null;
    enabled: boolean;
  }> = [];

  for (const c of categories) {
    const key = String((c as any)?.key || '').trim();
    const label = String((c as any)?.label || '').trim();
    if (!key || !label) continue;
    const k = key.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);

    out.push({
      key,
      label,
      icon: normalizeIconRef((c as any)?.icon),
      enabled: (c as any)?.enabled !== false,
    });
  }

  return out;
}

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

function normalizePromoBannersForAdmin(value: any) {
  const banners = value && typeof value === 'object' ? (value as any).banners : null;
  if (!Array.isArray(banners)) return [];

  const out = banners
    .map((b: any) => ({
      url: typeof b?.url === 'string' ? b.url.trim() : '',
      enabled: b?.enabled !== false,
      startsAt: toIsoOrNull(b?.startsAt),
      endsAt: toIsoOrNull(b?.endsAt),
      title: typeof b?.title === 'string' ? b.title.trim() : null,
      subtitle: typeof b?.subtitle === 'string' ? b.subtitle.trim() : null,
      ctaLabel: typeof b?.ctaLabel === 'string' ? b.ctaLabel.trim() : null,
      ctaPath: typeof b?.ctaPath === 'string' ? b.ctaPath.trim() : null,
    }))
    .filter((b: any) => Boolean(b.url));

  for (const b of out) {
    if (b.startsAt && b.endsAt && new Date(b.startsAt) > new Date(b.endsAt)) {
      throw new BadRequestException('Promo banner startsAt must be <= endsAt');
    }
  }

  return out;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/app-config')
export class AdminAppConfigController {
  constructor(
    private appConfig: AppConfigService,
    private cloud: CloudinaryService,
    private audit: AuditService,
  ) {}

  @Get('hero-banner')
  async getHeroBanner() {
    const row = await this.appConfig.getConfig('heroBanner');
    const url = resolveActiveBanner(row?.value).url;
    return { value: row?.value ?? null, url, updatedAt: row?.updatedAt || null };
  }

  @Put('hero-banner')
  async setHeroBanner(@Body() body: { url?: string; banners?: any[] }, @Req() req: any) {
    // Backward compatible: accept single URL
    if (body?.url !== undefined) {
      const url = typeof body?.url === 'string' ? body.url.trim() : '';
      const value = url ? { url } : { url: null };
      const row = await this.appConfig.setConfig('heroBanner', value);
      await this.audit.logAdminAction({
        userId: req?.user?.id,
        action: 'APP_CONFIG_SET',
        resource: 'heroBanner',
        meta: { mode: 'single_url', hasUrl: Boolean(url) },
      });
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
    await this.audit.logAdminAction({
      userId: req?.user?.id,
      action: 'APP_CONFIG_SET',
      resource: 'heroBanner',
      meta: { mode: 'schedule', count: banners.length },
    });
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

  @Get('promo-banners')
  async getPromoBanners() {
    const row = await this.appConfig.getConfig('promoBanners');
    const banners = normalizePromoBannersForAdmin(row?.value);
    return { banners, updatedAt: row?.updatedAt || null };
  }

  @Put('promo-banners')
  async setPromoBanners(
    @Body()
    body: {
      banners?: Array<{
        url?: string;
        enabled?: boolean;
        startsAt?: string | null;
        endsAt?: string | null;
        title?: string | null;
        subtitle?: string | null;
        ctaLabel?: string | null;
        ctaPath?: string | null;
      }>;
    },
    @Req() req: any,
  ) {
    const banners = normalizePromoBannersForAdmin({ banners: body?.banners || [] });
    const row = await this.appConfig.setConfig('promoBanners', { banners });
    await this.audit.logAdminAction({
      userId: req?.user?.id,
      action: 'APP_CONFIG_SET',
      resource: 'promoBanners',
      meta: { count: banners.length },
    });
    return { ok: true, banners: normalizePromoBannersForAdmin(row.value), updatedAt: row.updatedAt };
  }

  @Post('promo-banners/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024) },
    }),
  )
  async uploadPromoBannerImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('File required');
    if (!file.buffer) throw new BadRequestException('File buffer missing');

    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type');
    }

    const uploaded = await this.cloud.uploadBuffer(file.buffer, 'mobile_promotions');
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
    @Req() req: any,
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
      await this.audit.logAdminAction({
        userId: req?.user?.id,
        action: 'APP_CONFIG_SET',
        resource: 'mobileTabs',
        meta: { mode: 'legacy', enabled: enabled.length },
      });
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
    await this.audit.logAdminAction({
      userId: req?.user?.id,
      action: 'APP_CONFIG_SET',
      resource: 'mobileTabs',
      meta: { enabled: next.filter((t: any) => t.enabled !== false).length },
    });
    return { ok: true, tabs: normalizeMobileTabsForAdmin(row.value), updatedAt: row.updatedAt };
  }

  @Get('mobile-categories')
  async getMobileCategories() {
    const row = await this.appConfig.getConfig('mobileCategories');
    const categories = normalizeMobileCategoriesForAdmin(row?.value);
    return { categories, updatedAt: row?.updatedAt || null };
  }

  @Put('mobile-categories')
  async setMobileCategories(
    @Body()
    body: {
      categories?: Array<{
        key?: string;
        label?: string;
        icon?: string | { pack?: string; name?: string } | null;
        enabled?: boolean;
      }>;
    },
    @Req() req: any,
  ) {
    const categoriesRaw = Array.isArray(body?.categories) ? body.categories : [];
    const categories = categoriesRaw
      .map((c) => ({
        key: String(c?.key || '').trim(),
        label: String(c?.label || '').trim(),
        icon: normalizeIconRef((c as any)?.icon),
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
    await this.audit.logAdminAction({
      userId: req?.user?.id,
      action: 'APP_CONFIG_SET',
      resource: 'mobileCategories',
      meta: { enabled: unique.filter((c: any) => c.enabled !== false).length, total: unique.length },
    });
    return {
      ok: true,
      categories: normalizeMobileCategoriesForAdmin(row.value),
      updatedAt: row.updatedAt,
    };
  }
}
