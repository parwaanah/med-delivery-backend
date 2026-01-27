"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const API_URL = process.env.QA_API_URL || 'http://localhost:3001';
const CUSTOMER_EMAIL = process.env.QA_CUSTOMER_EMAIL || 'lt_customer@test.com';
const CUSTOMER_PASS = process.env.QA_CUSTOMER_PASS || 'loadtest123';
const PHARMACY_EMAIL = process.env.QA_PHARMACY_EMAIL || 'lt_pharmacy@test.com';
const TOTAL_ORDERS = Math.min(Math.max(Number(process.env.QA_ORDERS || 20), 1), 500);
const CONCURRENCY = Math.min(Math.max(Number(process.env.QA_CONCURRENCY || 10), 1), 100);
async function apiPost(path, body, token) {
    const res = await (0, node_fetch_1.default)(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    }
    catch {
        json = text;
    }
    if (!res.ok) {
        throw new Error(`${path} failed (${res.status}): ${json?.message || text || 'error'}`);
    }
    return json;
}
async function apiGet(path, token) {
    const res = await (0, node_fetch_1.default)(`${API_URL}${path}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    }
    catch {
        json = text;
    }
    if (!res.ok) {
        throw new Error(`${path} failed (${res.status}): ${json?.message || text || 'error'}`);
    }
    return json;
}
async function login(email, password) {
    const res = await apiPost('/auth/login', { email, password });
    const token = res?.access_token || res?.accessToken;
    if (!token)
        throw new Error('No access token returned from login');
    return token;
}
async function ensureIds() {
    const pharmacy = await prisma.user.findFirst({
        where: { email: PHARMACY_EMAIL, role: client_1.UserRole.PHARMACY },
        select: { id: true, status: true },
    });
    if (!pharmacy)
        throw new Error(`Pharmacy not found: ${PHARMACY_EMAIL}`);
    if (String(pharmacy.status).toUpperCase() !== 'APPROVED') {
        throw new Error(`Pharmacy ${PHARMACY_EMAIL} is not APPROVED (status=${pharmacy.status})`);
    }
    const med = await prisma.medicine.findFirst({
        orderBy: { id: 'asc' },
        select: { id: true, name: true, category: true, rxType: true },
    });
    if (!med)
        throw new Error('No medicines found in DB');
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
async function createOrder(token, pharmacyId, med) {
    return apiPost('/orders', {
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
    }, token);
}
async function runPool(items, concurrency, fn) {
    const results = [];
    let idx = 0;
    async function worker() {
        while (idx < items.length) {
            const i = items[idx++];
            try {
                const value = await fn(i);
                results.push({ ok: true, value });
            }
            catch (error) {
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
    console.log(`Created ${ok}/${created.length} orders in ${elapsedMs}ms (fail=${fail}, concurrency=${CONCURRENCY})`);
    const orderIds = created
        .filter((r) => r.ok && r.value?.orderId)
        .map((r) => Number(r.value.orderId))
        .filter((v) => Number.isFinite(v));
    const pharmacyToken = await login(PHARMACY_EMAIL, CUSTOMER_PASS);
    const list = await apiGet('/pharmacy/orders?status=PENDING', pharmacyToken);
    const orders = Array.isArray(list) ? list : list?.orders || [];
    const found = orders.filter((o) => orderIds.includes(Number(o.id))).length;
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
