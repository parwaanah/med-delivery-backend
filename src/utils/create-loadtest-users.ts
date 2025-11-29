import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();

  console.log("🚀 Creating Load Test Users...");

  // ---------- COMMON PASSWORD ----------
  const PASSWORD = "loadtest123";
  const hash = await bcrypt.hash(PASSWORD, 10);

  // ---------- USER 1: Customer ----------
  await prisma.user.upsert({
    where: { email: "lt_customer@test.com" },
    update: {},
    create: {
      name: "LoadTest Customer",
      email: "lt_customer@test.com",
      password: hash,
      role: "CUSTOMER",
      status: "APPROVED",
    },
  });

  // ---------- USER 2: Pharmacy ----------
  await prisma.user.upsert({
    where: { email: "lt_pharmacy@test.com" },
    update: {},
    create: {
      name: "LoadTest Pharmacy",
      email: "lt_pharmacy@test.com",
      password: hash,
      role: "PHARMACY",
      status: "APPROVED",
    },
  });

  // ---------- USER 3: Rider ----------
  await prisma.user.upsert({
    where: { email: "lt_rider@test.com" },
    update: {},
    create: {
      name: "LoadTest Rider",
      email: "lt_rider@test.com",
      password: hash,
      role: "RIDER",
      status: "APPROVED",
    },
  });

  console.log("✅ Load Test Users Created & Auto-Approved");
  console.log({
    CUSTOMER: "lt_customer@test.com",
    PHARMACY: "lt_pharmacy@test.com",
    RIDER: "lt_rider@test.com",
    PASSWORD,
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error creating load test users:", e);
  process.exit(1);
});
