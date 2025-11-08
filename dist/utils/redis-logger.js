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
let heartbeatTimer = null;
let lastState = null;
async function checkRedisConnection(redisUrl) {
    if (client && client.status === 'ready') {
        return client;
    }
    if (!client) {
        console.log('🔌 Initializing Redis connection...');
        client = new ioredis_1.default(redisUrl, {
            enableReadyCheck: true,
            retryStrategy: (times) => Math.min(times * 500, 5000),
            maxRetriesPerRequest: null,
        });
        client.on('connect', () => console.log(`✅ Redis Connected: ${redisUrl}`));
        client.on('ready', () => console.log('⚡ Redis Ready for commands'));
        client.on('end', () => console.warn('🔴 Redis connection ended — retrying...'));
        client.on('error', (err) => console.error('❌ Redis Error:', err?.message || err));
    }
    if (!heartbeatTimer) {
        heartbeatTimer = setInterval(async () => {
            if (!client)
                return;
            try {
                await client.ping();
                if (lastState !== 'up')
                    console.log('💓 Redis heartbeat OK');
                lastState = 'up';
            }
            catch (err) {
                if (lastState !== 'down')
                    console.error('💀 Redis heartbeat failed:', err instanceof Error ? err.message : err);
                lastState = 'down';
            }
        }, 30_000);
    }
    if (client.status !== 'ready') {
        await new Promise((resolve) => {
            const onReady = () => {
                client?.off('ready', onReady);
                resolve();
            };
            client?.once('ready', onReady);
            setTimeout(resolve, 3000);
        });
    }
    return client;
}
async function redisPing(redisUrl) {
    if (!client) {
        const tmp = new ioredis_1.default(redisUrl || 'redis://127.0.0.1:6379', { enableReadyCheck: false });
        try {
            await tmp.ping();
            await tmp.quit();
            return true;
        }
        catch (err) {
            try {
                await tmp.disconnect();
            }
            catch { }
            throw err;
        }
    }
    const res = await client.ping();
    return res === 'PONG';
}
async function closeRedisConnection() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (client) {
        console.log('🧹 Closing Redis connection...');
        try {
            await client.quit();
        }
        catch {
            try {
                client.disconnect();
            }
            catch { }
        }
        finally {
            client = null;
            lastState = null;
        }
    }
}
