import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding medicines + inventory...");

  const pharmacyId = 17;
  let pharmacy = await prisma.user.findUnique({ where: { id: pharmacyId } });

  if (!pharmacy) {
    console.log(`❌ Pharmacy ID ${pharmacyId} not found. Creating default pharmacy...`);
    pharmacy = await prisma.user.create({
      data: {
        id: pharmacyId,
        name: "Seed Pharmacy",
        email: "seed_pharmacy@example.com",
        password: "123456",
        role: "PHARMACY",
        status: "APPROVED",
      },
    });
  }

  const meds = [
    { name: "Paracetamol", sku: "MED-001" },
    { name: "Amoxicillin", sku: "MED-002" },
    { name: "Ibuprofen", sku: "MED-003" },
    { name: "Cetirizine", sku: "MED-004" },
    { name: "Azithromycin", sku: "MED-005" },
  ];

  for (const m of meds) {
    await prisma.medicine.upsert({
      where: { sku: m.sku },
      update: {},
      create: m,
    });
  }

  const allMeds = await prisma.medicine.findMany();

  for (const m of allMeds) {
    const base = 25 + m.id;

    await prisma.pharmacyInventory.upsert({
      where: {
        pharmacyId_medicineId: {
          pharmacyId,
          medicineId: m.id,
        },
      },
      update: {
        mrp: base,
        sellingPrice: base - 5,
        discount: 10,
        stock: 50,
      },
      create: {
        pharmacyId,
        medicineId: m.id,
        mrp: base,
        sellingPrice: base - 5,
        discount: 10,
        stock: 50,
      },
    });
  }

  console.log("✅ Seed Completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
