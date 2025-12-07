import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting FULL seed…");

  const file = path.join(__dirname, "medicines.json");

  if (!fs.existsSync(file)) {
    console.error("❌ medicines.json not found. Run generate_medicines.js first.");
    process.exit(1);
  }

  const medicines = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`📦 Found ${medicines.length} medicines in JSON`);

  // --------- CREATE A DEFAULT PHARMACY ---------
  const pharmacyId = 17;

  let pharmacy = await prisma.user.findUnique({ where: { id: pharmacyId } });

  if (!pharmacy) {
    console.log("🏥 Creating default pharmacy (ID 17)...");
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

  // --------- INSERT MEDICINES ---------
  console.log("💊 Inserting medicines…");

  const batch = 500;
  for (let i = 0; i < medicines.length; i += batch) {
    await prisma.medicine.createMany({
      data: medicines.slice(i, i + batch),
      skipDuplicates: true,
    });
    console.log(
      `  → Inserted ${Math.min(i + batch, medicines.length)}/${medicines.length}`
    );
  }

  // --------- CREATE INVENTORY FOR PHARMACY ---------
  console.log("📦 Building pharmacy inventory...");

  const allMeds = await prisma.medicine.findMany();

  for (const m of allMeds) {
    const basePrice = 50 + m.id;

    await prisma.pharmacyInventory.upsert({
      where: {
        pharmacyId_medicineId: {
          pharmacyId: pharmacyId,
          medicineId: m.id,
        },
      },
      update: {
        mrp: basePrice,
        sellingPrice: basePrice - 10,
        discount: 20,
        stock: 50,
      },
      create: {
        pharmacyId: pharmacyId,
        medicineId: m.id,
        mrp: basePrice,
        sellingPrice: basePrice - 10,
        discount: 20,
        stock: 50,
      },
    });
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
