// src/utils/redis-logger.ts
import IORedis from 'ioredis';

let client: IORedis | null = null;

export async function checkRedisConnection(redisUrl?: string) {
  if (client) return client;

  const url = redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  client.on('error', (err) => {
    console.error('Redis error:', err?.message || err);
  });

  // wait until ready (non-blocking): resolve immediately (caller can ping)
  return client;
}

/**
 * ping the redis instance. Accepts optional redisUrl if you want a fresh client.
 * Returns true if PONG, false otherwise.
 */
export async function redisPing(redisUrl?: string) {
  try {
    const c = client || (await checkRedisConnection(redisUrl));
    if (!c) return false;
    const pong = await c.ping();
    return String(pong).toUpperCase() === 'PONG';
  } catch (err) {
    console.warn('redisPing failed', err);
    return false;
  }
}

export async function closeRedisConnection() {
  if (client) {
    try {
      await client.quit();
    } catch {
      try {
        client.disconnect();
      } catch {}
    }
  }
  client = null;
}
