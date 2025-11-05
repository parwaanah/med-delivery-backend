import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUserIfNotExists(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    console.log(`ℹ️ User already exists: ${data.email}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: passwordHash,
      role: data.role,
      status: data.status || 'APPROVED',
    },
  });
  console.log(`✅ Created user: ${data.email} (${data.role})`);
  return user;
}

async function main() {
  console.log('🌱 Starting safe, idempotent seed...');

  // ✅ Ensure super admin always exists
  const superAdmin = await createUserIfNotExists({
    name: 'Super Admin',
    email: 'superadmin_live@example.com',
    password: 'superadmin123',
    role: UserRole.ADMIN,
    status: 'APPROVED',
  });

  // ✅ Pharmacies
  const pharmacy1 = await createUserIfNotExists({
    name: 'MediCare Pharmacy',
    email: 'pharmacy1@med.com',
    password: 'password',
    role: UserRole.PHARMACY,
  });

  const pharmacy2 = await createUserIfNotExists({
    name: 'Wellness Drugs',
    email: 'pharmacy2@med.com',
    password: 'password',
    role: UserRole.PHARMACY,
  });

  // ✅ Riders
  const rider1 = await createUserIfNotExists({
    name: 'John Rider',
    email: 'rider1@med.com',
    password: 'password',
    role: UserRole.RIDER,
  });

  const rider2 = await createUserIfNotExists({
    name: 'Jane Courier',
    email: 'rider2@med.com',
    password: 'password',
    role: UserRole.RIDER,
  });

  // ✅ Customers
  const customer1 = await createUserIfNotExists({
    name: 'Alice Customer',
    email: 'customer1@med.com',
    password: 'password',
    role: UserRole.CUSTOMER,
  });

  const customer2 = await createUserIfNotExists({
    name: 'Bob Buyer',
    email: 'customer2@med.com',
    password: 'password',
    role: UserRole.CUSTOMER,
  });

  // ✅ Mock orders (only if not exist)
  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
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
    console.log('✅ Orders created.');
  } else {
    console.log(`ℹ️ Orders already exist (${existingOrders} found).`);
  }

  console.log('✅ Safe seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
