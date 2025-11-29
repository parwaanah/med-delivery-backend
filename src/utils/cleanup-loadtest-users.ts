// src/utils/cleanup-loadtest-users.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning existing loadtest users…");

  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "lt_customer@test.com",
          "lt_pharmacy@test.com",
          "lt_rider@test.com",
          "superadmin_live@example.com"
        ]
      }
    }
  });

  console.log("✅ Cleaned up old loadtest users.");
}

main().finally(() => prisma.$disconnect());
