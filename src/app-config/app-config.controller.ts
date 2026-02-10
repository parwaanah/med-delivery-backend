import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

function resolveActiveBanner(value: any) {
  if (!value || typeof value !== 'object') return { url: null, active: null, banners: null };

  // Backward compatible: { url }
  if (typeof (value as any).url === 'string') {
    const url = String((value as any).url).trim() || null;
    return { url, active: url ? { url } : null, banners: null };
  }

  const banners = Array.isArray((value as any).banners) ? (value as any).banners : null;
  if (!banners) return { url: null, active: null, banners: null };

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

  const active = candidates[0] ? { url: candidates[0].url } : null;
  return { url: active?.url ?? null, active, banners };
}

@Controller('config')
export class AppConfigController {
  constructor(private appConfig: AppConfigService) {}

  @Get('hero-banner')
  async getHeroBanner() {
    const row = await this.appConfig.getConfig('heroBanner');
    const resolved = resolveActiveBanner(row?.value);
    return {
      url: resolved.url,
      updatedAt: row?.updatedAt || null,
    };
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

  @Get('mobile-categories')
  async getMobileCategories() {
    const row = await this.appConfig.getConfig('mobileCategories');
    const categories =
      row && typeof row.value === 'object' && row.value
        ? (row.value as any).categories || null
        : null;
    return { categories, updatedAt: row?.updatedAt || null };
  }
}
