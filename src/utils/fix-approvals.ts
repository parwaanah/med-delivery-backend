// src/utils/fix-approvals.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ Your real superadmin ID
const SUPERADMIN_ID = 215;

async function run() {
  console.log("⚙ Approving load-test users…");

  const emails = [
    'lt_pharmacy@test.com',
    'lt_rider@test.com',
    'superadmin_live@example.com'
  ];

  for (const email of emails) {
    await prisma.user.updateMany({
      where: { email },
      data: {
        status: 'ACTIVE',
        approvedBy: SUPERADMIN_ID, // FK references valid admin ID
      },
    });
  }

  console.log("✅ All load-test users APPROVED.");

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("❌ Approval fix failed:", e);
  process.exit(1);
});
