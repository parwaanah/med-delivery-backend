const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const pharm = await p.user.findUnique({ where: { email: 'pharmacy.srinagar@test.com' } });
  if (!pharm) { console.log('pharmacy not found'); process.exit(1); }
  if (pharm.latitude == null || pharm.longitude == null) {
    await p.user.update({ where: { id: pharm.id }, data: { latitude: 34.0837, longitude: 74.7973 } });
    console.log('pharmacy coords updated');
  } else {
    console.log('pharmacy coords already set');
  }
  await p.$disconnect();
})();
