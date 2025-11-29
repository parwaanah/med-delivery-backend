// src/utils/fix-loadtest-env.ts
import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const HASH_ROUNDS = 10;

async function createUser(
  email: string,
  role: UserRole,
  name: string
) {
  const password = await bcrypt.hash("loadtest123", HASH_ROUNDS);

  return prisma.user.create({
    data: {
      email,
      password,
      name,
      role,
      status: "ACTIVE",
      latitude: 19.0760,
      longitude: 72.8777
    }
  });
}

async function main() {
  console.log("⚙ Creating loadtest users with correct hash…");

  await createUser("superadmin_live@example.com", UserRole.ADMIN, "Super Admin");
  await createUser("lt_customer@test.com", UserRole.CUSTOMER, "Load Customer");
  await createUser("lt_pharmacy@test.com", UserRole.PHARMACY, "Load Pharmacy");
  await createUser("lt_rider@test.com", UserRole.RIDER, "Load Rider");

  console.log("✅ All loadtest users created with correct registered password.");
}

main().finally(() => prisma.$disconnect());
