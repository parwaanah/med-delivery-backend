import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting FULL seed…");

  const file = path.join(__dirname, "medicines.json");

  if (!fs.existsSync(file)) {
    console.error("❌ medicines.json not found.");
    process.exit(1);
  }

  const medicines = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`📦 Found ${medicines.length} medicines in JSON`);

  /* -------------------------------
     PHARMACY (IDEMPOTENT)
  -------------------------------- */
  let pharmacy = await prisma.user.findFirst({
    where: { role: "PHARMACY" },
  });

  if (!pharmacy) {
    console.log("🏥 Creating seed pharmacy...");
    pharmacy = await prisma.user.create({
      data: {
        name: "Seed Pharmacy",
        email: "seed_pharmacy@example.com",
        password: await bcrypt.hash("123456", 10),
        role: "PHARMACY",
        status: "APPROVED",
        emailVerified: true,
      },
    });
  }

  const pharmacyId = pharmacy.id;
  console.log(`🏥 Using pharmacyId = ${pharmacyId}`);

  /* -------------------------------
     MEDICINES
  -------------------------------- */
  console.log("💊 Inserting medicines…");

  const batch = 500;
  for (let i = 0; i < medicines.length; i += batch) {
    await prisma.medicine.createMany({
      data: medicines.slice(i, i + batch),
      skipDuplicates: true,
    });
    console.log(`→ ${Math.min(i + batch, medicines.length)}/${medicines.length}`);
  }

  /* -------------------------------
     INVENTORY
  -------------------------------- */
  console.log("📦 Creating inventory...");

  const allMeds = await prisma.medicine.findMany({ select: { id: true } });

  for (const m of allMeds) {
    const base = 50 + m.id;

    await prisma.pharmacyInventory.upsert({
      where: {
        pharmacyId_medicineId: {
          pharmacyId,
          medicineId: m.id,
        },
      },
      update: {
        mrp: base,
        sellingPrice: base - 10,
        discount: 20,
        stock: 50,
      },
      create: {
        pharmacyId,
        medicineId: m.id,
        mrp: base,
        sellingPrice: base - 10,
        discount: 20,
        stock: 50,
      },
    });
  }

  console.log("✅ Seed completed successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
