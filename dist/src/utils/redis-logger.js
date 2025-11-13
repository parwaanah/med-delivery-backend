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
    client = new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
    client.on('error', (err) => {
        console.error('Redis error:', err?.message || err);
    });
    return client;
}
async function redisPing() {
    try {
        if (!client)
            return false;
        const pong = await client.ping();
        return pong === 'PONG';
    }
    catch {
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
