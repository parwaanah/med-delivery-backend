"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
(async () => {
    const prisma = new client_1.PrismaClient();
    console.log('🧪 Running quick DB connectivity check...');
    const userCount = await prisma.user.count();
    console.log(`✅ Connected. Users in DB: ${userCount}`);
    await prisma.$disconnect();
})();
