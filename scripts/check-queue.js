const { Queue } = require('bullmq');
const Redis = require('ioredis');
const conn = { host: process.env.REDIS_HOST || 'med_delivery_redis', port: Number(process.env.REDIS_PORT||6379) };
const q = new Queue('order_assign', { connection: conn });
(async()=>{
  const counts = await q.getJobCounts('waiting','active','completed','failed','delayed');
  console.log(counts);
  await q.close();
  process.exit(0);
})();
