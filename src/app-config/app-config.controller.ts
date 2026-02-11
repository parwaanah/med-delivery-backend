import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

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

function normalizeMobileCategories(value: any) {
  const categories =
    value && typeof value === 'object' && value ? (value as any).categories : null;
  if (!Array.isArray(categories)) return [];

  const seen = new Set<string>();
  const out: Array<{ key: string; label: string; icon: { pack: MobileIconPack; name: string } | null; enabled: boolean }> =
    [];

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

function normalizeMobileTabs(value: any) {
  // Backward compatible: stored as { tabs: string[] }
  const legacy = value && typeof value === 'object' ? (value as any).tabs : null;
  if (Array.isArray(legacy) && legacy.every((t) => typeof t === 'string')) {
    const allowed = new Set(DEFAULT_MOBILE_TABS.map((t) => t.key));
    const ordered = Array.from(new Set(legacy.map((t) => String(t).trim()))).filter((t) =>
      allowed.has(t as any),
    );
    const out = ordered
      .map((k) => DEFAULT_MOBILE_TABS.find((t) => t.key === k) || null)
      .filter(Boolean);
    return out.length ? out : DEFAULT_MOBILE_TABS.slice();
  }

  // New format: stored as { tabs: Array<{key,title,icon,enabled}> }
  const tabs = value && typeof value === 'object' ? (value as any).tabs : null;
  if (!Array.isArray(tabs)) return DEFAULT_MOBILE_TABS.slice();

  const allowed = new Set(DEFAULT_MOBILE_TABS.map((t) => t.key));
  const seen = new Set<string>();

  const normalized = tabs
    .map((t: any) => {
      const key = String(t?.key || '').trim() as MobileTabKey;
      if (!allowed.has(key)) return null;

      const titleRaw = typeof t?.title === 'string' ? t.title.trim() : '';
      const iconRaw = typeof t?.icon === 'string' ? t.icon.trim() : '';
      const enabled = t?.enabled !== false;

      const fallback = DEFAULT_MOBILE_TABS.find((x) => x.key === key)!;
      return {
        key,
        title: titleRaw || fallback.title,
        icon: iconRaw || fallback.icon,
        enabled,
      };
    })
    .filter(Boolean)
    .filter((t: any) => {
      const k = String(t.key);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  // Ensure stable order and include missing defaults (disabled by default when missing).
  const byKey = new Map(normalized.map((t: any) => [t.key, t]));
  return DEFAULT_MOBILE_TABS.map((d) => byKey.get(d.key) || { ...d, enabled: false });
}

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

function normalizePromoBanners(value: any) {
  const banners = value && typeof value === 'object' ? (value as any).banners : null;
  if (!Array.isArray(banners)) return [];

  return banners
    .map((b: any) => ({
      url: typeof b?.url === 'string' ? b.url.trim() : '',
      enabled: b?.enabled !== false,
      startsAt: b?.startsAt ? new Date(b.startsAt).toISOString() : null,
      endsAt: b?.endsAt ? new Date(b.endsAt).toISOString() : null,
      title: typeof b?.title === 'string' ? b.title.trim() : null,
      subtitle: typeof b?.subtitle === 'string' ? b.subtitle.trim() : null,
      ctaLabel: typeof b?.ctaLabel === 'string' ? b.ctaLabel.trim() : null,
      ctaPath: typeof b?.ctaPath === 'string' ? b.ctaPath.trim() : null,
    }))
    .filter((b: any) => Boolean(b.url));
}

function resolveActivePromoBanners(value: any) {
  const banners = normalizePromoBanners(value);
  const now = Date.now();
  return banners
    .filter((b: any) => b.enabled !== false)
    .filter((b: any) => {
      const startsAt = b.startsAt ? new Date(b.startsAt).getTime() : null;
      const endsAt = b.endsAt ? new Date(b.endsAt).getTime() : null;
      return (startsAt == null || startsAt <= now) && (endsAt == null || endsAt >= now);
    })
    .sort((a: any, c: any) => {
      const as = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const cs = c.startsAt ? new Date(c.startsAt).getTime() : 0;
      return cs - as;
    });
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
    const value = row?.value;
    const tabs = normalizeMobileTabs(value);
    // Return only enabled tabs for the app, in order.
    return { tabs: tabs.filter((t: any) => t.enabled !== false), updatedAt: row?.updatedAt || null };
  }

  @Get('mobile-categories')
  async getMobileCategories() {
    const row = await this.appConfig.getConfig('mobileCategories');
    const categories = normalizeMobileCategories(row?.value);
    // Return enabled categories only.
    return { categories: categories.filter((c) => c.enabled !== false), updatedAt: row?.updatedAt || null };
  }

  @Get('promo-banners')
  async getPromoBanners() {
    const row = await this.appConfig.getConfig('promoBanners');
    const active = resolveActivePromoBanners(row?.value);
    return { banners: active, updatedAt: row?.updatedAt || null };
  }
}
