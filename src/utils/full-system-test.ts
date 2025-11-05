import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  console.log('🧪 Running quick DB connectivity check...');
  const userCount = await prisma.user.count();
  console.log(`✅ Connected. Users in DB: ${userCount}`);
  await prisma.$disconnect();
})();
