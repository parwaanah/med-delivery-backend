// src/utils/e2e-full.ts
/**
 * FULL E2E test (E2E-FULL)
 * - Requires: BASE_URL (defaults http://localhost:3001), ADMIN credentials (seeded)
 * - Run: MED_IDS="18,19,20,21,22,23" npx ts-node src/utils/e2e-full.ts
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const API = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin_live@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'superadmin123';
const PASSWORD = 'e2e-pass-123';
const MED_IDS = process.env.MED_IDS ? process.env.MED_IDS.split(',').map(x => Number(x)) : [18,19,20,21,22,23];

const http = axios.create({ baseURL: API, timeout: 20000 });

async function safe<T>(p: Promise<T>) {
  try { return { ok: true, data: await p }; } catch (err: any) { return { ok: false, err }; }
}

async function call(path: string, method = 'GET', body?: any, token?: string) {
  return safe(http.request({ url: path, method, data: body, headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(r => r.data));
}

function assert(ok: boolean, msg: string) {
  if (!ok) throw new Error(msg);
}

async function sleep(ms = 500) { return new Promise(res => setTimeout(res, ms)); }

async function main() {
  console.log('\n🚀 E2E-FULL START\n');

  // Admin login
  const adminLogin = await call('/auth/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert(adminLogin.ok, `Admin login failed: ${adminLogin.err?.message || adminLogin.err}`);
  const adminToken = adminLogin.data?.accessToken || adminLogin.data?.access_token;
  console.log('✅ Admin logged in');

  // Create test users (customer, pharmacy, rider)
  const timestamp = Date.now();
  const custEmail = `e2e_customer_${timestamp}@test.com`;
  const pharmEmail = `e2e_pharmacy_${timestamp}@test.com`;
  const riderEmail = `e2e_rider_${timestamp}@test.com`;

  const cust = await call('/auth/register', 'POST', { name: 'E2E Customer', email: custEmail, password: PASSWORD, role: 'CUSTOMER' });
  const pharm = await call('/auth/register', 'POST', { name: 'E2E Pharmacy', email: pharmEmail, password: PASSWORD, role: 'PHARMACY' });
  const rider = await call('/auth/register', 'POST', { name: 'E2E Rider', email: riderEmail, password: PASSWORD, role: 'RIDER' });
  assert(cust.ok && pharm.ok && rider.ok, 'Register failed');

  const cId = cust.data?.user?.id;
  const pId = pharm.data?.user?.id;
  const rId = rider.data?.user?.id;
  console.log('✅ Users registered');

  // Approve via admin
  await call(`/admin/users/${cId}/approve`, 'PATCH', null, adminToken);
  await call(`/admin/users/${pId}/approve`, 'PATCH', null, adminToken);
  await call(`/admin/users/${rId}/approve`, 'PATCH', null, adminToken);
  console.log('✅ Users approved');

  // Login test users
  const custLogin = await call('/auth/login', 'POST', { email: custEmail, password: PASSWORD });
  const pharmLogin = await call('/auth/login', 'POST', { email: pharmEmail, password: PASSWORD });
  const riderLogin = await call('/auth/login', 'POST', { email: riderEmail, password: PASSWORD });
  assert(custLogin.ok && pharmLogin.ok && riderLogin.ok, 'User login failed');
  const custToken = custLogin.data.accessToken;
  const pharmToken = pharmLogin.data.accessToken;
  const riderToken = riderLogin.data.accessToken;
  console.log('✅ Users logged in');

  // Optional: seed inventory for pharmacy (call pharmacy inventory add if route exists)
  try {
    if (Array.isArray(MED_IDS) && MED_IDS.length) {
      console.log('🏪 Seeding pharmacy inventory for E2E...');
      for (const mid of MED_IDS.slice(0, 6)) {
        const addResp = await call(`/pharmacies/${pId}/inventory/add`, 'POST', { medicineId: mid, sellingPrice: 49.99 + mid, mrp: 59.99 + mid, discount: 0, stock: 10 }, pharmToken);
        if (!addResp.ok) console.warn('warn: inventory add returned', addResp.err?.message || addResp.err);
        await sleep(120);
      }
      console.log('✅ Pharmacy inventory seeded (best-effort)');
    }
  } catch (e) { console.warn('inventory seed failed (non-fatal)'); }

  // Helper to place order
  async function placeOrder(type: 'NON_RX'|'CHRONIC'|'STRICT_RX', medId:number) {
    console.log(`\n📦 Placing order: ${type} for med ${medId}`);
    const payload = { items: [{ medicineId: medId, name: `${type}-${medId}`, quantity: 1, price: 49.99, category: type }], address: 'E2E Address' };
    const r = await call('/orders', 'POST', payload, custToken);
    assert(r.ok, `Place order failed: ${JSON.stringify(r.err?.response?.data || r.err)}`);
    const orderId = r.data?.order?.id || r.data?.id || r.data?.orderId || r.data?.id;
    console.log(`→ created orderId=${orderId}`);
    return { raw: r.data, id: Number(orderId) };
  }

  // Place three orders
  const o1 = await placeOrder('NON_RX', MED_IDS[0] ?? 1);
  const o2 = await placeOrder('CHRONIC', MED_IDS[1] ?? 2);
  const o3 = await placeOrder('STRICT_RX', MED_IDS[2] ?? 3);

  // STRICT_RX upload prescription and attach to order
  console.log('\n📑 Uploading prescription (STRICT_RX)');
  const strictOrderId = o3.id;
  const pres = await call('/orders/prescription/upload', 'POST', { url: 'https://example.com/e2e-prescription.jpg', attachOrderId: strictOrderId }, custToken);
  assert(pres.ok, 'Prescription upload failed');
  console.log('✅ Prescription uploaded');

  // Pharmacy accepts NON_RX order
  const nonRxOrderId = o1.id;
  console.log('\n🏥 Pharmacy responding to NON_RX order (ACCEPT)');
  const pharmResp = await call(`/orders/pharmacy/${nonRxOrderId}/respond`, 'POST', { action: 'ACCEPTED' }, pharmToken);
  assert(pharmResp.ok, `Pharmacy accept failed: ${JSON.stringify(pharmResp.err?.response?.data || pharmResp.err)}`);
  console.log('✅ Pharmacy accepted');

  // Rider accepts and updates stage to DELIVERED
  console.log('\n🚴 Rider accepts then delivers');
  const riderResp = await call(`/orders/rider/${nonRxOrderId}/respond`, 'POST', { action: 'ACCEPTED' }, riderToken);
  assert(riderResp.ok, 'Rider accept failed');
  await sleep(300);
  const stageResp = await call(`/orders/rider/${nonRxOrderId}/stage`, 'PATCH', { stage: 'DELIVERED' }, riderToken);
  assert(stageResp.ok, 'Rider stage update failed');
  console.log('✅ Rider delivered');

  // Fetch timeline
  console.log('\n🕒 Fetching timeline');
  const timeline = await call(`/orders/timeline/${nonRxOrderId}`, 'GET', null, custToken);
  assert(timeline.ok, 'Timeline fetch failed');
  console.log('→ timeline events:', Array.isArray(timeline.data) ? timeline.data.map((e:any)=>e.event).join(', ') : JSON.stringify(timeline.data));

  // Payment webhook simulation for pay-first orders (if any)
  console.log('\n🔔 Simulate payment webhook (if payments exist)');
  try {
    // Try to find payments by order
    const paymentsList = await call(`/payments/by-order/${nonRxOrderId}`, 'GET', null, adminToken);
    if (paymentsList.ok && Array.isArray(paymentsList.data) && paymentsList.data.length) {
      for (const p of paymentsList.data) {
        console.log('→ Marking payment as succeeded via webhook simulation for paymentId=', p.id);
        await call('/payments/webhook', 'POST', { provider: p.provider || 'razorpay', event: 'payment.captured', data: { paymentId: p.id, orderId: nonRxOrderId, status: 'SUCCEEDED' } });
      }
    } else {
      console.log('→ No payments found for that order (skip)');
    }
  } catch (e) { console.warn('payment webhook simulation failed (non-fatal)', e); }

  // Basic endpoint checks (health, swagger)
  console.log('\n❤️ Health & docs checks');
  const health = await call('/health', 'GET');
  assert(health.ok && health.data, '/health failed');
  console.log('→ /health OK');

  // Cleanup
  console.log('\n🧹 Cleaning up test users');
  await call(`/admin/users/${rId}`, 'DELETE', null, adminToken);
  await call(`/admin/users/${pId}`, 'DELETE', null, adminToken);
  await call(`/admin/users/${cId}`, 'DELETE', null, adminToken);
  console.log('✅ Cleanup done');

  console.log('\n✨ E2E-FULL FINISHED SUCCESSFULLY ✨\n');
}

main().catch(err => {
  console.error('E2E-FULL ERROR', err);
  process.exit(1);
});
