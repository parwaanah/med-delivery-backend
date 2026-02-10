import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';
import { UserRole } from '@prisma/client';

function isEnabled(name: string, defaultValue = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function resolveMedicinesJsonPath() {
  const fromEnv = String(process.env.MEDICINES_JSON_PATH || '').trim();
  if (fromEnv) return fromEnv;

  // Works both in ts-node (repo root) and in Docker image (/app)
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'dist', 'prisma', 'medicines.json'),
    path.join(cwd, 'prisma', 'medicines.json'),
  ];

  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

export async function runDevSeedIfEmpty(prisma: PrismaService) {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const enabled =
    !isProd &&
    (isEnabled('SEED_ON_START', false) || isEnabled('OTP_DUMMY', false) || isEnabled('AUTO_SEED', false));

  if (!enabled) return;

  const existing = await prisma.medicine.count();
  if (existing > 0) return;

  const file = resolveMedicinesJsonPath();
  if (!fs.existsSync(file)) {
    console.warn('⚠️  Seed skipped: medicines.json not found at', file);
    return;
  }

  console.log('🌱 Seeding medicines (dev)…');

  const medicines = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<Record<string, any>>;
  console.log(`📦 Found ${medicines.length} medicines in JSON`);

  const batch = 500;
  for (let i = 0; i < medicines.length; i += batch) {
    await prisma.medicine.createMany({
      data: medicines.slice(i, i + batch) as any,
      skipDuplicates: true,
    });
    console.log(`→ ${Math.min(i + batch, medicines.length)}/${medicines.length}`);
  }

  // Optional: create a dev pharmacy + inventory so results show stock/prices
  if (!isEnabled('SEED_INVENTORY', true)) return;

  const pharmacyEmail = String(process.env.SEED_PHARMACY_EMAIL || 'seed_pharmacy@example.com')
    .trim()
    .toLowerCase();
  const pharmacyPassword = String(process.env.SEED_PHARMACY_PASSWORD || '123456').trim();

  const pharmacy = await prisma.user.upsert({
    where: { email: pharmacyEmail },
    update: { role: UserRole.PHARMACY, status: 'APPROVED', emailVerified: true },
    create: {
      name: 'Seed Pharmacy',
      email: pharmacyEmail,
      password: await bcrypt.hash(pharmacyPassword, 10),
      role: UserRole.PHARMACY,
      status: 'APPROVED',
      emailVerified: true,
    },
  });

  const allMeds = await prisma.medicine.findMany({ select: { id: true, price: true } });
  const invRows = allMeds.map((m) => {
    const base = Number(m.price ?? 0) > 0 ? Number(m.price) : 99;
    const mrp = base + 20;
    const selling = base;
    const discount = mrp > 0 ? Math.round(((mrp - selling) / mrp) * 100) : 0;
    return {
      pharmacyId: pharmacy.id,
      medicineId: m.id,
      stock: 50,
      mrp: mrp.toFixed(2),
      sellingPrice: selling.toFixed(2),
      discount,
    };
  });

  for (let i = 0; i < invRows.length; i += batch) {
    await prisma.pharmacyInventory.createMany({
      data: invRows.slice(i, i + batch) as any,
      skipDuplicates: true,
    });
  }

  console.log('✅ Dev seed completed (medicines + inventory)');
}

