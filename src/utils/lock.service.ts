import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class LockService {
  constructor(private readonly redis: RedisService) {}

  private token() {
    // avoid requiring crypto polyfills; good enough for lock token uniqueness
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
      .toString(16)
      .slice(2)}`;
  }

  async acquire(key: string, ttlMs: number) {
    const token = this.token();
    const ok = await this.redis.client.set(key, token, {
      NX: true,
      PX: Math.max(1, Math.floor(ttlMs)),
    });
    return ok ? token : null;
  }

  async release(key: string, token: string) {
    const lua = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end`;
    try {
      await this.redis.client.eval(lua, {
        keys: [key],
        arguments: [token],
      });
    } catch {
      // best-effort
    }
  }

  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
    opts?: { waitMs?: number; retries?: number },
  ): Promise<T> {
    const waitMs = Math.max(0, Math.floor(opts?.waitMs ?? 50));
    const retries = Math.max(0, Math.floor(opts?.retries ?? 20));

    let token: string | null = null;
    for (let i = 0; i <= retries; i++) {
      token = await this.acquire(key, ttlMs);
      if (token) break;
      if (i < retries) await sleep(waitMs);
    }

    if (!token) {
      // caller decides to retry; we throw so upstream can treat it like conflict
      throw new Error(`LOCK_BUSY:${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }
}

