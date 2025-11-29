"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const SUPERADMIN_ID = 215;
async function run() {
    console.log("⚙ Approving load-test users…");
    const emails = [
        'lt_pharmacy@test.com',
        'lt_rider@test.com',
        'superadmin_live@example.com'
    ];
    for (const email of emails) {
        await prisma.user.updateMany({
            where: { email },
            data: {
                status: 'ACTIVE',
                approvedBy: SUPERADMIN_ID,
            },
        });
    }
    console.log("✅ All load-test users APPROVED.");
    await prisma.$disconnect();
}
run().catch((e) => {
    console.error("❌ Approval fix failed:", e);
    process.exit(1);
});
