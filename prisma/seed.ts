import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1️⃣ Clear existing data (safe for dev)
  await prisma.order.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  // 2️⃣ Hash passwords
  const password = await bcrypt.hash('password', 10);

  // 3️⃣ Create base users
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@med.com',
      password,
      role: UserRole.ADMIN,
    },
  });

  const pharmacy1 = await prisma.user.create({
    data: {
      name: 'MediCare Pharmacy',
      email: 'pharmacy1@med.com',
      password,
      role: UserRole.PHARMACY,
    },
  });

  const pharmacy2 = await prisma.user.create({
    data: {
      name: 'Wellness Drugs',
      email: 'pharmacy2@med.com',
      password,
      role: UserRole.PHARMACY,
    },
  });

  const rider1 = await prisma.user.create({
    data: {
      name: 'John Rider',
      email: 'rider1@med.com',
      password,
      role: UserRole.RIDER,
    },
  });

  const rider2 = await prisma.user.create({
    data: {
      name: 'Jane Courier',
      email: 'rider2@med.com',
      password,
      role: UserRole.RIDER,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      name: 'Alice Customer',
      email: 'customer1@med.com',
      password,
      role: UserRole.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: 'Bob Buyer',
      email: 'customer2@med.com',
      password,
      role: UserRole.CUSTOMER,
    },
  });

  // 4️⃣ Mock Orders
  await prisma.order.createMany({
    data: [
      {
        customerId: customer1.id,
        pharmacyId: pharmacy1.id,
        riderId: rider1.id,
        status: 'DELIVERED',
        totalPrice: 1200,
        createdAt: new Date(),
      },
      {
        customerId: customer2.id,
        pharmacyId: pharmacy2.id,
        riderId: rider2.id,
        status: 'OUT_FOR_DELIVERY',
        totalPrice: 800,
        createdAt: new Date(),
      },
      {
        customerId: customer1.id,
        pharmacyId: pharmacy2.id,
        riderId: rider1.id,
        status: 'PENDING',
        totalPrice: 600,
        createdAt: new Date(),
      },
    ],
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
