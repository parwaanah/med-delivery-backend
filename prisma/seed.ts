import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1️⃣ Safety check - don't wipe production accidentally
  if (process.env.NODE_ENV === 'production') {
    console.log('❌ Seeding aborted — running in production!');
    process.exit(1);
  }

  // 2️⃣ Clear existing data only for dev
  console.log('🧹 Clearing old data...');
  await prisma.order.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  // 3️⃣ Common password for all seeded users
  const passwordHash = await bcrypt.hash('password', 10);

  // 4️⃣ Create Super Admin
  const superAdminEmail = 'superadmin_live@example.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: superAdminEmail } });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: superAdminEmail,
        password: await bcrypt.hash('superadmin123', 10),
        role: UserRole.ADMIN,
        status: 'APPROVED',
      },
    });
    console.log(`✅ Super Admin created: ${superAdminEmail}`);
  } else {
    console.log(`ℹ️ Super Admin already exists: ${superAdminEmail}`);
  }

  // 5️⃣ Create pharmacies
  const pharmacy1 = await prisma.user.create({
    data: {
      name: 'MediCare Pharmacy',
      email: 'pharmacy1@med.com',
      password: passwordHash,
      role: UserRole.PHARMACY,
      status: 'APPROVED',
    },
  });

  const pharmacy2 = await prisma.user.create({
    data: {
      name: 'Wellness Drugs',
      email: 'pharmacy2@med.com',
      password: passwordHash,
      role: UserRole.PHARMACY,
      status: 'APPROVED',
    },
  });

  // 6️⃣ Create riders
  const rider1 = await prisma.user.create({
    data: {
      name: 'John Rider',
      email: 'rider1@med.com',
      password: passwordHash,
      role: UserRole.RIDER,
      status: 'APPROVED',
    },
  });

  const rider2 = await prisma.user.create({
    data: {
      name: 'Jane Courier',
      email: 'rider2@med.com',
      password: passwordHash,
      role: UserRole.RIDER,
      status: 'APPROVED',
    },
  });

  // 7️⃣ Create customers
  const customer1 = await prisma.user.create({
    data: {
      name: 'Alice Customer',
      email: 'customer1@med.com',
      password: passwordHash,
      role: UserRole.CUSTOMER,
      status: 'APPROVED',
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      name: 'Bob Buyer',
      email: 'customer2@med.com',
      password: passwordHash,
      role: UserRole.CUSTOMER,
      status: 'APPROVED',
    },
  });

  // 8️⃣ Mock orders
  console.log('🧾 Creating sample orders...');
  await prisma.order.createMany({
    data: [
      {
        customerId: customer1.id,
        pharmacyId: pharmacy1.id,
        riderId: rider1.id,
        status: 'DELIVERED',
        totalPrice: 1200,
      },
      {
        customerId: customer2.id,
        pharmacyId: pharmacy2.id,
        riderId: rider2.id,
        status: 'OUT_FOR_DELIVERY',
        totalPrice: 800,
      },
      {
        customerId: customer1.id,
        pharmacyId: pharmacy2.id,
        riderId: rider1.id,
        status: 'PENDING',
        totalPrice: 600,
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
