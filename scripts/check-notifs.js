const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const list = await p.notification.findMany({ where: { receiverId: 12 }, orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(list);
  await p.$disconnect();
})();
