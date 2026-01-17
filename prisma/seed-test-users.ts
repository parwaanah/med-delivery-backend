import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function createUserIfNotExists(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    console.log(`ℹ️ Admin already exists: ${data.email}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: passwordHash,
      role: data.role,
      status: "APPROVED",
      emailVerified: true, // ✅ explicit
    },
  });

  console.log(`✅ Created admin: ${data.email}`);
  return user;
}

async function main() {
  console.log("🌱 Admin seed started...");

  await createUserIfNotExists({
    name: "Super Admin",
    email: "superadmin_live@example.com",
    password: "superadmin123",
    role: UserRole.ADMIN,
  });

  console.log("✅ Admin seed completed");
}

main()
  .catch((e) => {
    console.error("❌ Admin seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
