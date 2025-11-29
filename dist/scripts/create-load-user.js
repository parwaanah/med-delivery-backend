"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const email = "loadtest@example.com";
    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({
        data: {
            name: "Load Tester",
            email,
            password: "$2b$10$7FcGctIWSIKXf6O0TQF5gOsYjS00xAmV6OQjxeT2xvcU'zWfIHcYO",
            role: "CUSTOMER",
            status: "APPROVED",
        },
    });
    console.log("Load test user created:", user);
}
main().finally(() => prisma.$disconnect());
