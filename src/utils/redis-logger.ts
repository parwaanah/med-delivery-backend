import IORedis from 'ioredis';

let client: IORedis | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let lastState: 'up' | 'down' | null = null;

/**
 * Create or return existing Redis client and start a heartbeat.
 * Safe to call multiple times — it will reuse existing client.
 */
export async function checkRedisConnection(redisUrl: string) {
  if (client && client.status === 'ready') {
    // already connected
    return client;
  }

  if (!client) {
    console.log('🔌 Initializing Redis connection...');
    client = new IORedis(redisUrl, {
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      maxRetriesPerRequest: null,
    });

    client.on('connect', () => console.log(`✅ Redis Connected: ${redisUrl}`));
    client.on('ready', () => console.log('⚡ Redis Ready for commands'));
    client.on('end', () => console.warn('🔴 Redis connection ended — retrying...'));
    client.on('error', (err) => console.error('❌ Redis Error:', err?.message || err));
  }

  // start heartbeat only once
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(async () => {
      if (!client) return;
      try {
        await client.ping();
        if (lastState !== 'up') console.log('💓 Redis heartbeat OK');
        lastState = 'up';
      } catch (err) {
        if (lastState !== 'down')
          console.error('💀 Redis heartbeat failed:', err instanceof Error ? err.message : err);
        lastState = 'down';
      }
    }, 30_000);
  }

  // wait until client is ready (simple wait)
  if (client.status !== 'ready') {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        client?.off('ready', onReady);
        resolve();
      };
      client?.once('ready', onReady);
      // fallback timeout
      setTimeout(resolve, 3000);
    });
  }

  return client;
}

/**
 * Ping Redis without creating a new persistent client (uses existing client).
 * Used by health checks — throws when not available.
 */
export async function redisPing(redisUrl?: string) {
  if (!client) {
    // Try to create a short-lived client just for a ping if absolutely necessary.
    const tmp = new IORedis(redisUrl || 'redis://127.0.0.1:6379', { enableReadyCheck: false });
    try {
      await tmp.ping();
      await tmp.quit();
      return true;
    } catch (err) {
      try { await tmp.disconnect(); } catch {}
      throw err;
    }
  }
  const res = await client.ping();
  return res === 'PONG';
}

/**
 * Close global client and stop heartbeat
 */
export async function closeRedisConnection() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (client) {
    console.log('🧹 Closing Redis connection...');
    try {
      await client.quit();
    } catch {
      try { client.disconnect(); } catch {}
    } finally {
      client = null;
      lastState = null;
    }
  }
}
