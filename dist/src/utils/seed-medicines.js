"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding sample medicines...');
    await prisma.medicine.deleteMany();
    await prisma.medicine.createMany({
        data: [
            { name: 'Paracetamol 500mg', sku: 'S-NRX-001', category: 'NON_RX', rxType: 'NONE' },
            { name: 'Cough Syrup 100ml', sku: 'S-NRX-002', category: 'NON_RX', rxType: 'NONE' },
            { name: 'Metformin 500mg', sku: 'S-CHR-001', category: 'CHRONIC', rxType: 'SOFT' },
            { name: 'Amlodipine 5mg', sku: 'S-CHR-002', category: 'CHRONIC', rxType: 'SOFT' },
            { name: 'Amoxicillin 500mg', sku: 'S-RX-001', category: 'STRICT_RX', rxType: 'HARD' },
            { name: 'Azithromycin 500mg', sku: 'S-RX-002', category: 'STRICT_RX', rxType: 'HARD' },
        ],
    });
    console.log('Medicines seeded successfully.');
}
main().finally(() => prisma.$disconnect());
