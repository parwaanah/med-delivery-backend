"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRedisConnection = checkRedisConnection;
exports.redisPing = redisPing;
exports.closeRedisConnection = closeRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
let client = null;
async function checkRedisConnection(redisUrl) {
    if (client)
        return client;
    const url = redisUrl || process.env.REDIS_URL || 'redis://redis:6379';
    client = new ioredis_1.default(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
    client.on('error', (err) => {
        console.error('Redis error:', err?.message || err);
    });
    return client;
}
async function redisPing(redisUrl) {
    try {
        const c = client || (await checkRedisConnection(redisUrl));
        if (!c)
            return false;
        const pong = await c.ping();
        return String(pong).toUpperCase() === 'PONG';
    }
    catch (err) {
        console.warn('redisPing failed', err);
        return false;
    }
}
async function closeRedisConnection() {
    if (client) {
        try {
            await client.quit();
        }
        catch {
            try {
                client.disconnect();
            }
            catch { }
        }
    }
    client = null;
}
