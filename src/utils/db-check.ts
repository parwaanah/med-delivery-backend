import { PrismaClient } from '@prisma/client';

(async () => {
  const prisma = new PrismaClient();
  console.log('DB connectivity check...');
  const users = await prisma.user.count();
  console.log(`Users in DB: ${users}`);
  await prisma.$disconnect();
})();
