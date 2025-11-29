"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("⚙ Creating LoadTest Inventory...");
    const pharmacyUser = await prisma.user.findUnique({
        where: { email: "lt_pharmacy@test.com" }
    });
    if (!pharmacyUser) {
        console.error("❌ Pharmacy user missing. Run fix-loadtest-env.ts");
        return;
    }
    const med = await prisma.medicine.upsert({
        where: { sku: "LT-001" },
        update: {},
        create: {
            name: "LoadTestMed",
            sku: "LT-001",
            category: "NON_RX",
            rxType: "NONE"
        }
    });
    await prisma.pharmacyInventory.upsert({
        where: {
            pharmacyId_medicineId: {
                pharmacyId: pharmacyUser.id,
                medicineId: med.id
            }
        },
        update: { stock: 999999, sellingPrice: 10, mrp: 20 },
        create: {
            pharmacyId: pharmacyUser.id,
            medicineId: med.id,
            stock: 999999,
            sellingPrice: 10,
            mrp: 20
        }
    });
    console.log("✅ Inventory ready");
}
main().finally(() => prisma.$disconnect());
