"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
(async () => {
    const prisma = new client_1.PrismaClient();
    console.log('DB connectivity check...');
    const users = await prisma.user.count();
    console.log(`Users in DB: ${users}`);
    await prisma.$disconnect();
})();
