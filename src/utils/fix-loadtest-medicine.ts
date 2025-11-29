// src/utils/fix-loadtest-medicine.ts
import { PrismaClient, MedicineCategory, PrescriptionType } from "@prisma/client";

const prisma = new PrismaClient();

export default async function fixMedicine() {
  console.log("🔧 Fixing LOADTEST medicine…");

  const sku = "LT_MED_1";

  const med = await prisma.medicine.upsert({
    where: { sku },
    update: {
      name: "LoadTest Medicine",
      category: MedicineCategory.NON_RX,
      rxType: PrescriptionType.NONE,
    },
    create: {
      sku,
      name: "LoadTest Medicine",
      category: MedicineCategory.NON_RX,
      rxType: PrescriptionType.NONE,
    },
  });

  console.log(`✅ Medicine fixed (ID=${med.id}, category=NON_RX)`);
}

if (require.main === module) {
  fixMedicine()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
