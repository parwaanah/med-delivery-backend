"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = fixMedicine;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function fixMedicine() {
    console.log("🔧 Fixing LOADTEST medicine…");
    const sku = "LT_MED_1";
    const med = await prisma.medicine.upsert({
        where: { sku },
        update: {
            name: "LoadTest Medicine",
            category: client_1.MedicineCategory.NON_RX,
            rxType: client_1.PrescriptionType.NONE,
        },
        create: {
            sku,
            name: "LoadTest Medicine",
            category: client_1.MedicineCategory.NON_RX,
            rxType: client_1.PrescriptionType.NONE,
        },
    });
    console.log(`✅ Medicine fixed (ID=${med.id}, category=NON_RX)`);
}
if (require.main === module) {
    fixMedicine()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}
