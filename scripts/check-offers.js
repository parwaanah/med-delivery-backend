const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const offers = await p.orderOffer.findMany({ where: { orderId: 10 }, orderBy: { createdAt: 'desc' } });
  console.log(offers);
  await p.$disconnect();
})();
