"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Starting FULL seed…");
    const file = path.join(__dirname, "medicines.json");
    if (!fs.existsSync(file)) {
        console.error("❌ medicines.json not found. Run generate_medicines.js first.");
        process.exit(1);
    }
    const medicines = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log(`📦 Found ${medicines.length} medicines in JSON`);
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
    console.log("💊 Inserting medicines…");
    const batch = 500;
    for (let i = 0; i < medicines.length; i += batch) {
        await prisma.medicine.createMany({
            data: medicines.slice(i, i + batch),
            skipDuplicates: true,
        });
        console.log(`  → Inserted ${Math.min(i + batch, medicines.length)}/${medicines.length}`);
    }
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
