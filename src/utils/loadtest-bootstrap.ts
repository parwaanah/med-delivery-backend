// src/utils/loadtest-bootstrap.ts
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

export default async function bootstrap() {
  console.log("🚀 Bootstrapping Load Test Users…");

  const users = [
    {
      email: "lt_customer@test.com",
      name: "LoadTest Customer",
      role: UserRole.CUSTOMER,
    },
    {
      email: "lt_pharmacy@test.com",
      name: "LoadTest Pharmacy",
      role: UserRole.PHARMACY,
    },
    {
      email: "lt_rider@test.com",
      name: "LoadTest Rider",
      role: UserRole.RIDER,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        status: "APPROVED",
        approvedBy: 1, // SUPER ADMIN ID
      },
      create: {
        email: u.email,
        name: u.name,
        password: "$2a$10$uH9PMYd3waDqtnEoPPYUqefYkMJdHj7FVGHvXZHzVvzJeYdij24Uy", // loadtest123
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
