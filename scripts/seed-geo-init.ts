// scripts/seed-geo-init.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const redis = new Redis(redisUrl);

  console.log('🔄 Connecting to Redis:', redisUrl);

  // Clear existing GEO indexes
  console.log('🧹 Clearing old GEO keys...');
  await redis.del('riders:geo');
  await redis.del('pharmacies:geo');

  // Fetch all riders
  const riders = await prisma.user.findMany({
    where: { role: 'RIDER' },
    select: { id: true, latitude: true, longitude: true },
  });

  // Fetch all pharmacies
  const pharmacies = await prisma.user.findMany({
    where: { role: 'PHARMACY' },
    select: { id: true, latitude: true, longitude: true },
  });

  console.log(`📌 Found ${riders.length} riders`);
  console.log(`📌 Found ${pharmacies.length} pharmacies`);

  // Seed riders
  for (const r of riders) {
    if (r.latitude && r.longitude) {
      await redis.geoadd(
        'riders:geo',
        r.longitude,
        r.latitude,
        `rider:${r.id}`
      );
      console.log(`   ➕ Rider ${r.id} added to GEO`);
    } else {
      console.log(`   ⚠ Rider ${r.id} has no coordinates, skipped`);
    }
  }

  // Seed pharmacies
  for (const p of pharmacies) {
    if (p.latitude && p.longitude) {
      await redis.geoadd(
        'pharmacies:geo',
        p.longitude,
        p.latitude,
        `pharmacy:${p.id}`
      );
      console.log(`   ➕ Pharmacy ${p.id} added to GEO`);
    } else {
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
