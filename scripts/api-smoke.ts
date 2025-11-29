// scripts/api-smoke.ts
/**
 * Quick API smoke / endpoint sweep.
 * - Tries every public route with safe methods (GET/POST minimal payloads).
 * - Use ADMIN token to access protected admin routes.
 * Run: npx ts-node scripts/api-smoke.ts
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const API = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin_live@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'superadmin123';
const http = axios.create({ baseURL: API, timeout: 10000 });

async function call(path: string, method='GET', body?: any, token?: string) {
  try {
    const r = await http.request({ url: path, method, data: body, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    console.log(`OK ${method} ${path} -> ${r.status}`);
    return r.data;
  } catch (err: any) {
    console.warn(`ERR ${method} ${path} -> ${err?.response?.status || 'ERR'} ${err?.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    return null;
  }
}

async function main() {
  console.log('🔎 API smoke start');

  // login admin
  const admin = await call('/auth/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const adminToken = admin?.accessToken || admin?.access_token;

  // public/safe
  await call('/health', 'GET');
  await call('/docs', 'GET'); // swagger static
  await call('/pharmacies', 'GET', null, adminToken); // admin protected
  await call('/orders', 'GET', null); // will require auth, expect 401 or similar
  await call('/payments/admin/list', 'GET', null, adminToken).catch(()=>{});
  await call('/admin/users/pending', 'GET', null, adminToken);

  // try payments webhook endpoint (no token expected)
  await call('/payments/webhook', 'POST', { provider: 'razorpay', event: 'test.ping' });

  console.log('🔎 API smoke finished (check logs for any ERR entries)');
}

main().catch(e => { console.error(e); process.exit(1); });
