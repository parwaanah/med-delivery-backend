import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetPasswords() {
  try {
    const pharmacyHash = await bcrypt.hash("pharma123", 10);
    const riderHash = await bcrypt.hash("rider123", 10);

    console.log("Generated hashes:");
    console.log("Pharmacy:", pharmacyHash);
    console.log("Rider:", riderHash);

    await prisma.user.updateMany({
      where: { email: "pharmacy_auto2@example.com" },
      data: { password: pharmacyHash },
    });

    await prisma.user.updateMany({
      where: { email: "rider_auto2@example.com" },
      data: { password: riderHash },
    });

    console.log("✅ Passwords updated successfully");
  } catch (err) {
    console.error("❌ Error updating passwords:", err);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();