"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRedisConnection = checkRedisConnection;
exports.closeRedisConnection = closeRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
let redisClient = null;
let healthCheckInterval = null;
async function checkRedisConnection(redisUrl) {
    console.log('🔌 Initializing Redis connection...');
    redisClient = new ioredis_1.default(redisUrl, {
        retryStrategy: (times) => {
            const delay = Math.min(times * 500, 5000);
            console.warn(`🔁 Redis reconnect attempt #${times} in ${delay}ms...`);
            return delay;
        },
        reconnectOnError: (err) => {
            console.error('⚠️ Redis reconnectOnError:', err.message);
            return true;
        },
    });
    redisClient.on('connect', () => {
        console.log(`✅ Redis Connected Successfully: ${redisUrl}`);
    });
    redisClient.on('ready', () => {
        console.log('⚡ Redis Ready for commands');
    });
    redisClient.on('end', () => {
        console.warn('🔴 Redis connection closed. Awaiting reconnection...');
    });
    redisClient.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
    });
    healthCheckInterval = setInterval(async () => {
        try {
            if (redisClient?.status === 'ready') {
                await redisClient.ping();
                console.log('💓 Redis heartbeat OK');
            }
            else {
                console.warn('💤 Redis not ready, skipping heartbeat...');
            }
        }
        catch (err) {
            console.error('💀 Redis heartbeat failed:', err.message);
        }
    }, 30000);
    return redisClient;
}
async function closeRedisConnection() {
    if (healthCheckInterval)
        clearInterval(healthCheckInterval);
    if (redisClient) {
        console.log('🧹 Closing Redis connection gracefully...');
        await redisClient.quit();
        redisClient = null;
    }
}
