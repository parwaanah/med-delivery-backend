import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_META_KEY = 'rate_limit';

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export const RateLimit = (opts: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_META_KEY, opts);

