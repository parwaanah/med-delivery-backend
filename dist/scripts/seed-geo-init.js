"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma = new client_1.PrismaClient();
async function main() {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const redis = new ioredis_1.default(redisUrl);
    console.log('🔄 Connecting to Redis:', redisUrl);
    console.log('🧹 Clearing old GEO keys...');
    await redis.del('riders:geo');
    await redis.del('pharmacies:geo');
    const riders = await prisma.user.findMany({
        where: { role: 'RIDER' },
        select: { id: true, latitude: true, longitude: true },
    });
    const pharmacies = await prisma.user.findMany({
        where: { role: 'PHARMACY' },
        select: { id: true, latitude: true, longitude: true },
    });
    console.log(`📌 Found ${riders.length} riders`);
    console.log(`📌 Found ${pharmacies.length} pharmacies`);
    for (const r of riders) {
        if (r.latitude && r.longitude) {
            await redis.geoadd('riders:geo', r.longitude, r.latitude, `rider:${r.id}`);
            console.log(`   ➕ Rider ${r.id} added to GEO`);
        }
        else {
            console.log(`   ⚠ Rider ${r.id} has no coordinates, skipped`);
        }
    }
    for (const p of pharmacies) {
        if (p.latitude && p.longitude) {
            await redis.geoadd('pharmacies:geo', p.longitude, p.latitude, `pharmacy:${p.id}`);
            console.log(`   ➕ Pharmacy ${p.id} added to GEO`);
        }
        else {
            console.log(`   ⚠ Pharmacy ${p.id} has no coordinates, skipped`);
        }
    }
    await redis.quit();
    await prisma.$disconnect();
    console.log('✅ GEO initialization completed.');
}
main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
