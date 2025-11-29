import http from 'k6/http';
import { check, sleep, group } from 'k6';

// ---------------------------------------------------------
// BASE URL + FIXED ENTITIES
// ---------------------------------------------------------
const BASE = __ENV.BASE_URL || 'http://localhost:3001';

// Your fixed known-working IDs
const MED_ID = Number(__ENV.MED_ID || 1);
const FIXED_PHARMACY_ID = Number(__ENV.FIXED_PHARMACY_ID || 1);
const FIXED_RIDER_ID = Number(__ENV.FIXED_RIDER_ID || 3);   // ← set a valid RIDER ID

// ---------------------------------------------------------
// VIRTUAL USER ROLE RATIOS
// ---------------------------------------------------------
const VU_ROLE_RATIO = {
  customers: Number(__ENV.CUSTOMER_VUS || 30),
  pharmacies: Number(__ENV.PHARMACY_VUS || 10),
  admins: Number(__ENV.ADMIN_VUS || 2),
  riders: Number(__ENV.RIDER_VUS || 8),
};

// ---------------------------------------------------------
// ACCOUNT POOLS (1 per role = safest for load testing)
// ---------------------------------------------------------
const CREDENTIALS = {
  customers: [{ email: 'lt_customer@test.com', password: 'loadtest123' }],
  pharmacies: [{ email: 'lt_pharmacy@test.com', password: 'loadtest123' }],
  admins: [{ email: 'superadmin_live@example.com', password: 'superadmin123' }],
  riders: [{ email: 'lt_rider@test.com', password: 'loadtest123' }],
};

// ---------------------------------------------------------
// UTILS
// ---------------------------------------------------------
function randomFrom(arr) {
  return arr[0];  // deterministic = stable loadtest
}

function safeJson(res) {
  if (!res || !res.body) return null;
  try { return JSON.parse(res.body); }
  catch { return null; }
}

// ---------------------------------------------------------
// LOGIN SAFE (with retries)
// ---------------------------------------------------------
function login(email, password) {
  const res = http.post(`${BASE}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '5s',
      tags: { name: 'login' }
    }
  );
  if (!res || res.status !== 201) return null;

  const j = safeJson(res);
  const token = j?.accessToken || j?.token;
  return token ? `Bearer ${token}` : null;
}

function loginSafe(email, password, attempts = 6) {
  let token = null;
  for (let i = 0; i < attempts; i++) {
    token = login(email, password);
    if (token) break;
    sleep(0.3);
  }
  return token;
}

// ---------------------------------------------------------
// CUSTOMER FLOW
// ---------------------------------------------------------
function customerFlow() {
  const cred = randomFrom(CREDENTIALS.customers);
  const auth = loginSafe(cred.email, cred.password);

  check(auth, { 'customer logged-in': a => a !== null });
  if (!auth) return;

  const payload = {
    items: [
      {
        medicineId: MED_ID,
        name: "LoadTestMed",
        quantity: 1,
        price: 10,
        category: "NON_RX"
      }
    ],
    pharmacyId: FIXED_PHARMACY_ID,   // ← always valid
    address: "Loadtest address"
  };

  const res = http.post(`${BASE}/orders`,
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      timeout: '6s',
      tags: { name: 'create_order' }
    }
  );

  check(res, {
    "order created 2xx": r => r.status >= 200 && r.status < 300
  });

  sleep(1);
}

// ---------------------------------------------------------
// PHARMACY FLOW
// ---------------------------------------------------------
function pharmacyFlow() {
  const cred = randomFrom(CREDENTIALS.pharmacies);
  const auth = loginSafe(cred.email, cred.password);

  check(auth, { 'pharmacy logged-in': a => a !== null });
  if (!auth) return;

  const list = http.get(`${BASE}/orders`, {
    headers: { Authorization: auth },
    timeout: '5s'
  });

  const orders = safeJson(list);
  if (!Array.isArray(orders)) return;

  for (const o of orders) {
    if (o && o.status === 'PENDING' && o.id) {
      const res = http.post(
        `${BASE}/orders/pharmacy/${o.id}/respond`,
        JSON.stringify({ action: 'ACCEPTED' }),
        {
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          tags: { name: 'pharmacy_accept' }
        }
      );

      check(res, { "pharmacy accepted": r => r.status >= 200 });
      break;
    }
  }

  sleep(1);
}

// ---------------------------------------------------------
// ADMIN FLOW
// ---------------------------------------------------------
function adminFlow() {
  const cred = randomFrom(CREDENTIALS.admins);
  const auth = loginSafe(cred.email, cred.password);

  check(auth, { 'admin logged-in': a => a !== null });
  if (!auth) return;

  const list = http.get(`${BASE}/orders`, {
    headers: { Authorization: auth }
  });

  const orders = safeJson(list);
  if (!Array.isArray(orders)) return;

  for (const o of orders) {
    if (o && o.status === 'ACCEPTED' && !o.riderId) {
      const res = http.post(
        `${BASE}/orders/admin/${o.id}/assign/${FIXED_RIDER_ID}`,  // ← stable rider
        null,
        { headers: { Authorization: auth } }
      );

      check(res, { "admin assigned rider": r => r.status >= 200 });
      break;
    }
  }

  sleep(1);
}

// ---------------------------------------------------------
// RIDER FLOW
// ---------------------------------------------------------
function riderFlow() {
  const cred = randomFrom(CREDENTIALS.riders);
  const auth = loginSafe(cred.email, cred.password);

  check(auth, { 'rider logged-in': a => a !== null });
  if (!auth) return;

  const list = http.get(`${BASE}/orders`, {
    headers: { Authorization: auth }
  });

  const orders = safeJson(list);
  if (!Array.isArray(orders)) return;

  for (const o of orders) {
    if (!o || !o.id) continue;

    const shouldTake =
      o.riderId === FIXED_RIDER_ID ||
      o.status === 'OUT_FOR_DELIVERY';

    if (shouldTake) {
      // accept
      http.post(
        `${BASE}/orders/rider/${o.id}/respond`,
        JSON.stringify({ action: 'ACCEPTED' }),
        { headers: { 'Content-Type': 'application/json', Authorization: auth } }
      );
      sleep(0.5);

      // stages
      http.patch(
        `${BASE}/orders/rider/${o.id}/stage`,
        JSON.stringify({ stage: 'REACHED_PHARMACY' }),
        { headers: { 'Content-Type': 'application/json', Authorization: auth } }
      );
      sleep(0.5);

      http.patch(
        `${BASE}/orders/rider/${o.id}/stage`,
        JSON.stringify({ stage: 'PICKED_UP' }),
        { headers: { 'Content-Type': 'application/json', Authorization: auth } }
      );
      sleep(0.5);

      const res4 = http.patch(
        `${BASE}/orders/rider/${o.id}/stage`,
        JSON.stringify({ stage: 'DELIVERED' }),
        { headers: { 'Content-Type': 'application/json', Authorization: auth } }
      );

      check(res4, { 'rider delivered': r => r.status >= 200 });
      break;
    }
  }

  sleep(1);
}

// ---------------------------------------------------------
// K6 CONFIG
// ---------------------------------------------------------
export const options = {
  vus: Number(__ENV.K6_VUS || 50),
  duration: __ENV.K6_DURATION || '2m',
  thresholds: {
    http_req_failed: ['rate<0.10'],
    checks: ['rate>0.85'],
  },
};

// ---------------------------------------------------------
// ROLE DISTRIBUTION
// ---------------------------------------------------------
export default function () {
  const r = Math.random();
  const total =
    VU_ROLE_RATIO.customers +
    VU_ROLE_RATIO.pharmacies +
    VU_ROLE_RATIO.admins +
    VU_ROLE_RATIO.riders;

  const pC = VU_ROLE_RATIO.customers / total;
  const pP = VU_ROLE_RATIO.pharmacies / total;
  const pA = VU_ROLE_RATIO.admins / total;

  if (r < pC) return group('customer', customerFlow);
  if (r < pC + pP) return group('pharmacy', pharmacyFlow);
  if (r < pC + pP + pA) return group('admin', adminFlow);

  return group('rider', riderFlow);
}
