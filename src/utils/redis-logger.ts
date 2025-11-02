import Redis from 'ioredis';

let redisClient: Redis | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Checks and maintains a Redis connection with auto-reconnect and heartbeat logging.
 */
export async function checkRedisConnection(redisUrl: string) {
  console.log('🔌 Initializing Redis connection...');

  redisClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 5000); // Gradual backoff up to 5s
      console.warn(`🔁 Redis reconnect attempt #${times} in ${delay}ms...`);
      return delay;
    },
    reconnectOnError: (err) => {
      console.error('⚠️ Redis reconnectOnError:', err.message);
      return true; // Always retry on network or connection errors
    },
  });

  // When successfully connected
  redisClient.on('connect', () => {
    console.log(`✅ Redis Connected Successfully: ${redisUrl}`);
  });

  // When ready to accept commands
  redisClient.on('ready', () => {
    console.log('⚡ Redis Ready for commands');
  });

  // On disconnection
  redisClient.on('end', () => {
    console.warn('🔴 Redis connection closed. Awaiting reconnection...');
  });

  // On error
  redisClient.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
  });

  // 🔁 Heartbeat every 30 seconds
  healthCheckInterval = setInterval(async () => {
    try {
      if (redisClient?.status === 'ready') {
        await redisClient.ping();
        console.log('💓 Redis heartbeat OK');
      } else {
        console.warn('💤 Redis not ready, skipping heartbeat...');
      }
    } catch (err: any) {
      console.error('💀 Redis heartbeat failed:', err.message);
    }
  }, 30000);

  return redisClient;
}

/**
 * Gracefully closes Redis when the app shuts down.
 */
export async function closeRedisConnection() {
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (redisClient) {
    console.log('🧹 Closing Redis connection gracefully...');
    await redisClient.quit();
    redisClient = null;
  }
}
