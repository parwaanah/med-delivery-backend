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
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Starting FULL seed…");
    const file = path.join(__dirname, "medicines.json");
    if (!fs.existsSync(file)) {
        console.error("❌ medicines.json not found.");
        process.exit(1);
    }
    const medicines = JSON.parse(fs.readFileSync(file, "utf8"));
    console.log(`📦 Found ${medicines.length} medicines in JSON`);
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
    console.log("💊 Inserting medicines…");
    const batch = 500;
    for (let i = 0; i < medicines.length; i += batch) {
        await prisma.medicine.createMany({
            data: medicines.slice(i, i + batch),
            skipDuplicates: true,
        });
        console.log(`→ ${Math.min(i + batch, medicines.length)}/${medicines.length}`);
    }
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
