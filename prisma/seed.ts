import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding medicines + inventory...");

  // Ensure pharmacy exists
  const pharmacyId = 17;
  const pharmacy = await prisma.user.findUnique({ where: { id: pharmacyId } });

  if (!pharmacy) {
    console.log(`❌ Pharmacy ID ${pharmacyId} not found. Creating default pharmacy...`);
    await prisma.user.create({
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

  // fetch medicine IDs
  const allMeds = await prisma.medicine.findMany();

  // create inventory for ALL medicines
  for (const m of allMeds) {
    await prisma.pharmacyInventory.upsert({
      where: {
        pharmacyId_medicineId: {
          pharmacyId,
          medicineId: m.id,
        },
      },
      update: {
        price: 25 + m.id,
        stock: 50,
      },
      create: {
        pharmacyId,
        medicineId: m.id,
        price: 25 + m.id,
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
