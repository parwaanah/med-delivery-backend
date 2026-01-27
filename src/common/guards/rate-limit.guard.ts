import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../../cache/cache.service';
import {
  RATE_LIMIT_META_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';

type Bucket = { count: number; expiresAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const opts =
      this.reflector.getAllAndOverride<RateLimitOptions>(
        RATE_LIMIT_META_KEY,
        [context.getHandler(), context.getClass()],
      );
    if (!opts) return true;

    const req = context.switchToHttp().getRequest<any>();
    const subject = req?.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`;
    const key = `rl:${opts.key}:${subject}`;
    const now = Date.now();

    const existing = this.cache.get<Bucket>(key);
    if (!existing || now >= existing.expiresAt) {
      this.cache.set(key, { count: 1, expiresAt: now + opts.windowMs }, opts.windowMs);
      return true;
    }

    if (existing.count >= opts.limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((existing.expiresAt - now) / 1000),
      );
      throw new HttpException(
        `Too many requests. Retry after ${retryAfterSec}s`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const next: Bucket = { ...existing, count: existing.count + 1 };
    this.cache.set(key, next, Math.max(1, existing.expiresAt - now));
    return true;
  }
}
