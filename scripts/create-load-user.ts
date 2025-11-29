import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = "loadtest@example.com";

  // Delete existing if any
  await prisma.user.deleteMany({ where: { email } });

  // Create new customer
  const user = await prisma.user.create({
    data: {
      name: "Load Tester",
      email,
      password: "$2b$10$7FcGctIWSIKXf6O0TQF5gOsYjS00xAmV6OQjxeT2xvcU'zWfIHcYO", // hash for "123456"
      role: "CUSTOMER",
      status: "APPROVED",
    },
  });

  console.log("Load test user created:", user);
}

main().finally(() => prisma.$disconnect());
