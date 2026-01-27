// src/utils/qa-load-validation.ts
//
// Quick QA/Load validation harness (run inside backend container where DATABASE_URL works).
//
// Usage (examples):
//   node dist/src/utils/qa-load-validation.js
//   QA_ORDERS=25 QA_CONCURRENCY=10 node dist/src/utils/qa-load-validation.js
//
// Notes:
// - Expects loadtest users from `src/utils/loadtest-bootstrap.ts`
//   - lt_customer@test.com / loadtest123
//   - lt_pharmacy@test.com / loadtest123
//   - lt_rider@test.com / loadtest123
// - Creates N direct-pharmacy orders in parallel and prints timings.

import fetch from 'node-fetch';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const API_URL = process.env.QA_API_URL || 'http://localhost:3001';
const CUSTOMER_EMAIL = process.env.QA_CUSTOMER_EMAIL || 'lt_customer@test.com';
const CUSTOMER_PASS = process.env.QA_CUSTOMER_PASS || 'loadtest123';
const PHARMACY_EMAIL = process.env.QA_PHARMACY_EMAIL || 'lt_pharmacy@test.com';

const TOTAL_ORDERS = Math.min(
  Math.max(Number(process.env.QA_ORDERS || 20), 1),
  500,
);
const CONCURRENCY = Math.min(
  Math.max(Number(process.env.QA_CONCURRENCY || 10), 1),
  100,
);

async function apiPost(path: string, body: any, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(
      `${path} failed (${res.status}): ${json?.message || text || 'error'}`,
    );
  }
  return json;
}

async function apiGet(path: string, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(
      `${path} failed (${res.status}): ${json?.message || text || 'error'}`,
    );
  }
  return json;
}

async function login(email: string, password: string) {
  const res = await apiPost('/auth/login', { email, password });
  const token = res?.access_token || res?.accessToken;
  if (!token) throw new Error('No access token returned from login');
  return token as string;
}

async function ensureIds() {
  const pharmacy = await prisma.user.findFirst({
    where: { email: PHARMACY_EMAIL, role: UserRole.PHARMACY },
    select: { id: true, status: true },
  });
  if (!pharmacy) throw new Error(`Pharmacy not found: ${PHARMACY_EMAIL}`);
  if (String(pharmacy.status).toUpperCase() !== 'APPROVED') {
    throw new Error(
      `Pharmacy ${PHARMACY_EMAIL} is not APPROVED (status=${pharmacy.status})`,
    );
  }

  const med = await prisma.medicine.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, name: true, category: true, rxType: true },
  });
  if (!med) throw new Error('No medicines found in DB');

  return {
    pharmacyId: pharmacy.id,
    medicine: {
      id: med.id,
      name: med.name,
      category: String(med.category),
      rxType: String(med.rxType),
    },
  };
}

async function createOrder(token: string, pharmacyId: number, med: any) {
  return apiPost(
    '/orders',
    {
      pharmacyId,
      address: 'QA Address',
      items: [
        {
          medicineId: med.id,
          name: med.name,
          quantity: 1,
          price: 10,
          category: med.category || 'NON_RX',
        },
      ],
    },
    token,
  );
}

async function runPool<T>(items: number[], concurrency: number, fn: (i: number) => Promise<T>) {
  const results: Array<{ ok: boolean; value?: T; error?: any }> = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = items[idx++];
      try {
        const value = await fn(i);
        results.push({ ok: true, value });
      } catch (error) {
        results.push({ ok: false, error });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`QA API: ${API_URL}`);
  const { pharmacyId, medicine } = await ensureIds();
  console.log(`Using pharmacyId=${pharmacyId}, medicineId=${medicine.id} (${medicine.name})`);

  const customerToken = await login(CUSTOMER_EMAIL, CUSTOMER_PASS);

  // Health baseline (Redis + DB)
  const health = await apiGet('/health').catch((e) => ({ error: String(e) }));
  console.log('Health:', typeof health === 'string' ? health : JSON.stringify(health));

  const start = Date.now();
  const ids = Array.from({ length: TOTAL_ORDERS }, (_, i) => i + 1);
  const created = await runPool(ids, CONCURRENCY, async () => {
    const res = await createOrder(customerToken, pharmacyId, medicine);
    const orderId = Number(res?.order?.id ?? res?.id);
    return { orderId };
  });

  const ok = created.filter((r) => r.ok).length;
  const fail = created.length - ok;
  const elapsedMs = Date.now() - start;
  console.log(
    `Created ${ok}/${created.length} orders in ${elapsedMs}ms (fail=${fail}, concurrency=${CONCURRENCY})`,
  );

  const orderIds = created
    .filter((r) => r.ok && (r.value as any)?.orderId)
    .map((r) => Number((r.value as any).orderId))
    .filter((v) => Number.isFinite(v));

  // Quick sanity: pharmacy can see them
  const pharmacyToken = await login(PHARMACY_EMAIL, CUSTOMER_PASS);
  const list = await apiGet('/pharmacy/orders?status=PENDING', pharmacyToken);
  const orders = Array.isArray(list) ? list : list?.orders || [];
  const found = orders.filter((o: any) => orderIds.includes(Number(o.id))).length;
  console.log(`Pharmacy pending list contains ${found}/${orderIds.length} created orders`);
}

main()
  .catch((e) => {
    console.error('QA failed:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

