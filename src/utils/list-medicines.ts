import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const meds = await p.medicine.findMany();
  console.log(meds);
}

main().finally(() => p.$disconnect());
