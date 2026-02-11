import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';
import { CacheService } from '../cache/cache.service';

type WikimediaImageResult = {
  ok: boolean;
  query: string;
  title: string | null;
  pageUrl: string | null;
  imageUrl: string | null;
  provider: 'wikimedia';
  cached: boolean;
  error?: string;
};

@Injectable()
export class WikimediaService {
  private readonly logger = new Logger(WikimediaService.name);

  constructor(private readonly cache: CacheService) {}

  async searchImage(queryRaw: string, size: number): Promise<WikimediaImageResult> {
    const query = String(queryRaw || '').trim();
    if (!query || query.length < 2) {
      return {
        ok: false,
        query,
        title: null,
        pageUrl: null,
        imageUrl: null,
        provider: 'wikimedia',
        cached: false,
        error: 'Query too short',
      };
    }

    const safeSize = Number.isFinite(size) ? Math.max(64, Math.min(900, Math.round(size))) : 512;
    const cacheKey = `wikimedia:image:v1:${safeSize}:${query.toLowerCase()}`;
    const cached = this.cache.get<WikimediaImageResult>(cacheKey);
    if (cached) return { ...cached, cached: true };

    // Wikipedia API: find best page match + thumbnail.
    // We avoid doing Commons category parsing for now; this is "good enough" for a fallback image.
    const url =
      'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: '1',
        gsrwhat: 'text',
        prop: 'pageimages|info',
        inprop: 'url',
        piprop: 'thumbnail',
        pithumbsize: String(safeSize),
        pilimit: '1',
        redirects: '1',
      }).toString();

    try {
      const res = await fetch(url, { method: 'GET' });
      const json: any = await res.json().catch(() => null);
      if (!res.ok || !json) {
        const out: WikimediaImageResult = {
          ok: false,
          query,
          title: null,
          pageUrl: null,
          imageUrl: null,
          provider: 'wikimedia',
          cached: false,
          error: `Wikimedia request failed (${res.status})`,
        };
        this.cache.set(cacheKey, out, 1000 * 60 * 10);
        return out;
      }

      const pages = json?.query?.pages ? Object.values(json.query.pages) : [];
      const page: any = Array.isArray(pages) && pages.length ? pages[0] : null;

      const title = page?.title ? String(page.title) : null;
      const pageUrl = page?.fullurl ? String(page.fullurl) : null;
      const imageUrl = page?.thumbnail?.source ? String(page.thumbnail.source) : null;

      const out: WikimediaImageResult = {
        ok: Boolean(imageUrl),
        query,
        title,
        pageUrl,
        imageUrl,
        provider: 'wikimedia',
        cached: false,
        ...(imageUrl ? null : { error: 'No image found' }),
      };

      // Cache positive results longer, negative shorter.
      this.cache.set(cacheKey, out, imageUrl ? 1000 * 60 * 60 * 24 : 1000 * 60 * 15);
      return out;
    } catch (e: any) {
      this.logger.warn(`Wikimedia fetch error: ${e?.message || e}`);
      const out: WikimediaImageResult = {
        ok: false,
        query,
        title: null,
        pageUrl: null,
        imageUrl: null,
        provider: 'wikimedia',
        cached: false,
        error: 'Network error',
      };
      this.cache.set(cacheKey, out, 1000 * 60 * 5);
      return out;
    }
  }
}

