import { PrismaClient, $Enums } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 🧹 Clean existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.pharmacy.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.user.deleteMany();

  // ----- USERS -----
  const customer = await prisma.user.create({
    data: {
      name: 'John Customer',
      email: 'customer@example.com',
      password: 'password123',
      role: $Enums.Role.customer,
    },
  });

  const riderUser = await prisma.user.create({
    data: {
      name: 'Daisy Delivery',
      email: 'delivery@example.com',
      password: 'password123',
      role: $Enums.Role.rider,
    },
  });

  const pharmacyUser1 = await prisma.user.create({
    data: {
      name: 'HealthPlus Owner',
      email: 'pharmacy1@example.com',
      password: 'password123',
      role: $Enums.Role.pharmacy,
    },
  });

  const pharmacyUser2 = await prisma.user.create({
    data: {
      name: 'MediCare Owner',
      email: 'pharmacy2@example.com',
      password: 'password123',
      role: $Enums.Role.pharmacy,
    },
  });

  // ----- PHARMACIES -----
  const pharmacy1 = await prisma.pharmacy.create({
    data: {
      name: 'HealthPlus Pharmacy',
      address: '123 Main St',
      phone: '1234567890',
      userId: pharmacyUser1.id,
    },
  });

  const pharmacy2 = await prisma.pharmacy.create({
    data: {
      name: 'MediCare Pharmacy',
      address: '456 Oak Ave',
      phone: '0987654321',
      userId: pharmacyUser2.id,
    },
  });

  // ----- RIDER -----
  await prisma.rider.create({
    data: {
      name: 'Daisy Delivery',
      phone: '9998887776',
      vehicleNumber: 'DL09AB1234',
      userId: riderUser.id,
    },
  });

  // ----- MEDICINES -----
  await prisma.medicine.createMany({
    data: [
      { name: 'Paracetamol', description: 'Pain killer', price: 1.5, stock: 100, pharmacyId: pharmacy1.id },
      { name: 'Ibuprofen', description: 'Anti-inflammatory', price: 2, stock: 80, pharmacyId: pharmacy1.id },
      { name: 'Vitamin C', description: 'Supplement', price: 3, stock: 50, pharmacyId: pharmacy1.id },
      { name: 'Cough Syrup', description: 'For cough', price: 4, stock: 60, pharmacyId: pharmacy1.id },
      { name: 'Amoxicillin', description: 'Antibiotic', price: 5, stock: 40, pharmacyId: pharmacy2.id },
      { name: 'Aspirin', description: 'Pain & fever', price: 2.5, stock: 70, pharmacyId: pharmacy2.id },
      { name: 'Antacid', description: 'Stomach relief', price: 1.8, stock: 90, pharmacyId: pharmacy2.id },
      { name: 'Eye Drops', description: 'For eyes', price: 3.2, stock: 30, pharmacyId: pharmacy2.id },
    ],
  });

  // 🔍 Fetch newly created medicines for HealthPlus Pharmacy
  const medicines = await prisma.medicine.findMany({
    where: { pharmacyId: pharmacy1.id },
  });

  const paracetamol = medicines.find((m) => m.name === 'Paracetamol');
  const ibuprofen = medicines.find((m) => m.name === 'Ibuprofen');

  // ----- SAMPLE ORDER -----
  if (paracetamol && ibuprofen) {
    await prisma.order.create({
      data: {
        userId: customer.id,
        pharmacyId: pharmacy1.id,
        status: $Enums.OrderStatus.pending,
        items: {
          create: [
            { medicineId: paracetamol.id, quantity: 2, price: paracetamol.price },
            { medicineId: ibuprofen.id, quantity: 1, price: ibuprofen.price },
          ],
        },
      },
    });
  } else {
    console.warn('⚠️ Skipping sample order — medicines not found.');
  }

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
