import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function upsertUser(data: {
  email: string;
  name: string;
  passwordPlain: string;
  role: UserRole;
  lat?: number | null;
  lng?: number | null;
  forceApprove?: boolean;
}) {
  const { email, name, passwordPlain, role, lat = null, lng = null, forceApprove = false } = data;
  const hashed = await hash(passwordPlain);

  const status = role === UserRole.CUSTOMER || forceApprove ? 'APPROVED' : 'PENDING';

  return prisma.user.upsert({
    where: { email },
    update: { name, password: hashed, role, status, latitude: lat, longitude: lng, deletedAt: null },
    create: { name, email, password: hashed, role, status, latitude: lat, longitude: lng },
  });
}

async function upsertMedicine(name: string, sku?: string) {
  if (sku) {
    return prisma.medicine.upsert({
      where: { sku },
      update: { name, sku },
      create: { name, sku },
    });
  } else {
    const found = await prisma.medicine.findFirst({ where: { name } });
    if (found) return found;
    return prisma.medicine.create({ data: { name, sku: null } });
  }
}

async function upsertInventory(pharmacyId: number, medicineId: number, mrp: number, stock: number) {
  const sellingPrice = mrp - 5;
  return prisma.pharmacyInventory.upsert({
    where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    update: { mrp, sellingPrice, discount: 10, stock },
    create: { pharmacyId, medicineId, mrp, sellingPrice, discount: 10, stock },
  });
}

async function main() {
  console.log('📦 Starting seed script');

  const admin = await upsertUser({
    email: 'superadmin_live@example.com',
    name: 'Super Admin',
    passwordPlain: 'superadmin123',
    role: UserRole.ADMIN,
    forceApprove: true,
  });

  const customer1 = await upsertUser({
    email: 'customer@example.com',
    name: 'Test Customer',
    passwordPlain: 'customer123',
    role: UserRole.CUSTOMER,
    lat: 34.0837,
    lng: 74.7973,
  });

  const customer2 = await upsertUser({
    email: 'alice.customer@example.com',
    name: 'Alice Customer',
    passwordPlain: 'customer123',
    role: UserRole.CUSTOMER,
    lat: 34.09,
    lng: 74.80,
  });

  const pharmaciesData = [
    { email: 'cureplus.lalchowk@example.com', name: 'CurePlus Pharmacy – Lal Chowk', lat: 34.0700, lng: 74.7950 },
    { email: 'medico.rajbagh@example.com', name: 'Medico Srinagar – Rajbagh', lat: 34.0800, lng: 74.7850 },
    { email: 'citymed.hyderpora@example.com', name: 'CityMed Wellness – Hyderpora', lat: 34.0880, lng: 74.7955 },
    { email: 'healthfirst.bemina@example.com', name: 'HealthFirst Pharmacy – Bemina', lat: 34.0250, lng: 74.8050 },
    { email: 'medx.nishat@example.com', name: 'MedX Care – Nishat', lat: 34.0860, lng: 74.8160 },
    { email: 'lifeline.nowgam@example.com', name: 'LifeLine Pharmacy – Nowgam', lat: 34.0820, lng: 74.8400 },
  ];

  const pharmacies = [];
  for (const p of pharmaciesData) {
    pharmacies.push(
      await upsertUser({
        email: p.email,
        name: p.name,
        passwordPlain: 'pharmacy123',
        role: UserRole.PHARMACY,
        lat: p.lat,
        lng: p.lng,
      }),
    );
  }

  const riders = [];
  for (let i = 1; i <= 10; i++) {
    riders.push(
      await upsertUser({
        email: `rider${i}@example.com`,
        name: `Rider ${i}`,
        passwordPlain: 'rider123',
        role: UserRole.RIDER,
        lat: 34.07 + Math.random() * 0.03,
        lng: 74.79 + Math.random() * 0.03,
      }),
    );
  }

  const medNames = [
    'Paracetamol 500mg',
    'Ibuprofen 200mg',
    'Azithromycin 500mg',
    'Cetirizine 10mg',
    'Omeprazole 20mg',
    'Metformin 500mg',
    'Amoxicillin 500mg',
    'Loratadine 10mg',
    'Aspirin 75mg',
    'Cough Syrup 100ml',
    'Vitamin C 500mg',
    'Multivitamin Syrup 200ml',
  ];

  const meds = [];
  for (const name of medNames) {
    meds.push(await upsertMedicine(name));
  }

  for (let i = 0; i < pharmacies.length; i++) {
    const p = pharmacies[i];
    for (let j = 0; j < 6; j++) {
      const med = meds[(i * 3 + j) % meds.length];
      const mrp = 50 + (i + j) * 7;
      const stock = 5 + ((i + j) % 10);
      await upsertInventory(p.id, med.id, mrp, stock);
    }
  }

  console.log('✅ Seed complete');
  console.log('Admin:', admin.email);
}

main().catch((e) => {
  console.error('Seed error', e);
  process.exit(1);
});
