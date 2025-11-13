// src/utils/redis-logger.ts
import IORedis from 'ioredis';

let client: IORedis | null = null;

export async function checkRedisConnection(redisUrl: string) {
  if (client) return client;

  client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  client.on('error', (err) => {
    console.error('Redis error:', err?.message || err);
  });

  return client;
}

export async function redisPing() {
  try {
    if (!client) return false;
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
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
