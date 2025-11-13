import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  const users = [
    { name: 'Test Pharmacy Auto2', email: 'pharmacy_auto2@example.com', password: 'pharma123', role: UserRole.PHARMACY },
    { name: 'Test Rider Auto2', email: 'rider_auto2@example.com', password: 'rider123', role: UserRole.RIDER },
    { name: 'Test Customer Auto2', email: 'customer_auto2@example.com', password: 'customer123', role: UserRole.CUSTOMER },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      const hash = await bcrypt.hash(u.password, 10);
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hash,
          role: u.role,
          status: 'APPROVED',
        },
      });
      console.log(`Created user: ${u.email}`);
    } else {
      console.log(`User already exists: ${u.email}`);
    }
  }

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
