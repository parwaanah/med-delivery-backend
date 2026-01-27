const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const users = await p.user.findMany({
    where: { email: { in: ['pharmacy.srinagar@test.com','rider.srinagar@test.com'] } },
    select: { id: true, email: true, role: true, status: true, riderAvailability: true, latitude: true, longitude: true },
  });
  console.log(users);
  await p.$disconnect();
})();
