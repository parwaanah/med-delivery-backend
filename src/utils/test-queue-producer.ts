import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis('redis://redis:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const orders = new Queue('orders', { connection: redis });

(async () => {
  console.log('🚀 Adding sample jobs...');
  await orders.add('order_process', { orderId: 1001, customer: 'Alice' });
  await orders.add('order_process', { orderId: 1002, customer: 'Bob' });
  console.log('✅ Jobs added.');
  process.exit(0);
})();
