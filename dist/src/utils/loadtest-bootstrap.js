"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = bootstrap;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function bootstrap() {
    console.log("🚀 Bootstrapping Load Test Users…");
    const users = [
        {
            email: "lt_customer@test.com",
            name: "LoadTest Customer",
            role: client_1.UserRole.CUSTOMER,
        },
        {
            email: "lt_pharmacy@test.com",
            name: "LoadTest Pharmacy",
            role: client_1.UserRole.PHARMACY,
        },
        {
            email: "lt_rider@test.com",
            name: "LoadTest Rider",
            role: client_1.UserRole.RIDER,
        },
    ];
    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                name: u.name,
                role: u.role,
                status: "APPROVED",
                approvedBy: 1,
            },
            create: {
                email: u.email,
                name: u.name,
                password: "$2a$10$uH9PMYd3waDqtnEoPPYUqefYkMJdHj7FVGHvXZHzVvzJeYdij24Uy",
                role: u.role,
                status: "APPROVED",
                approvedBy: 1,
            },
        });
    }
    console.log("✅ Load Test Users Created");
}
if (require.main === module) {
    bootstrap()
        .catch(console.error)
        .finally(() => prisma.$disconnect());
}
