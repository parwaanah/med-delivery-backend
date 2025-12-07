"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const ioredis_1 = __importDefault(require("ioredis"));
const prisma = new client_1.PrismaClient();
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://redis:6379');
const GEO_KEY = 'geosurge:riders';
async function rebuildRiderGeo() {
    console.log('🚀 Starting Rider GeoSurge rebuild...');
    const riders = await prisma.user.findMany({
        where: { role: 'RIDER' },
        select: { id: true, latitude: true, longitude: true, status: true },
    });
    console.log(`📌 Found ${riders.length} riders in DB`);
    await redis.del(GEO_KEY);
    let count = 0;
    for (const r of riders) {
        if (!r.latitude || !r.longitude) {
            console.log(`⚠️ Skipping rider:${r.id} (no lat/lon)`);
            continue;
        }
        const id = `rider:${r.id}`;
        await redis.geoadd(GEO_KEY, r.longitude, r.latitude, id);
        await redis.hset(`geo:meta:${id}`, 'lon', String(r.longitude), 'lat', String(r.latitude), 'meta', JSON.stringify({ status: r.status }));
        count++;
        console.log(`✔ Added ${id} → lon:${r.longitude} lat:${r.latitude}`);
    }
    console.log(`\n✅ Rebuild complete. Total riders added: ${count}`);
    process.exit(0);
}
rebuildRiderGeo().catch((err) => {
    console.error('❌ Rebuild failed:', err);
    process.exit(1);
});
