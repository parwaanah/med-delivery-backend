import fetch from 'node-fetch';

const API = 'http://localhost:3001';

async function call(path: string, method = 'GET', body?: any, token?: string) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await (async () => {
    const t = await res.text();
    try { return JSON.parse(t); } catch { return t; }
  })();
  console.log(`${method} ${path} -> ${res.status}`);
  return { status: res.status, data };
}

(async () => {
  console.log('\nStarting E2E v12.3\n');

  // Admin login
  const adminLogin = await call('/auth/login', 'POST', { email: 'superadmin_live@example.com', password: 'superadmin123' });
  const adminToken = adminLogin.data?.accessToken || adminLogin.data?.access_token;

  // Create test users via register
  const cust = await call('/auth/register', 'POST', { name: 'Auto Customer', email: 'auto_customer_e2e@example.com', password: '123456', role: 'CUSTOMER' });
  const pharm = await call('/auth/register', 'POST', { name: 'Auto Pharmacy', email: 'auto_pharmacy_e2e@example.com', password: '123456', role: 'PHARMACY' });
  const rider = await call('/auth/register', 'POST', { name: 'Auto Rider', email: 'auto_rider_e2e@example.com', password: '123456', role: 'RIDER' });

  const cId = cust.data?.user?.id || cust.data?.id || 0;
  const pId = pharm.data?.user?.id || pharm.data?.id || 0;
  const rId = rider.data?.user?.id || rider.data?.id || 0;

  // Approve (admin)
  await call(`/admin/users/${cId}/approve`, 'PATCH', null, adminToken);
  await call(`/admin/users/${pId}/approve`, 'PATCH', null, adminToken);
  await call(`/admin/users/${rId}/approve`, 'PATCH', null, adminToken);

  // Login users
  const custLogin = await call('/auth/login', 'POST', { email: 'auto_customer_e2e@example.com', password: '123456' });
  const pharmLogin = await call('/auth/login', 'POST', { email: 'auto_pharmacy_e2e@example.com', password: '123456' });
  const riderLogin = await call('/auth/login', 'POST', { email: 'auto_rider_e2e@example.com', password: '123456' });

  const custToken = custLogin.data?.accessToken || custLogin.data?.access_token;
  const pharmToken = pharmLogin.data?.accessToken || pharmLogin.data?.access_token;
  const riderToken = riderLogin.data?.accessToken || riderLogin.data?.access_token;

  // Create order
  const order = await call('/orders', 'POST', {
    pharmacyId: pId,
    items: [{ name: 'Paracetamol', price: 20, quantity: 2 }]
  }, custToken);

  const orderId = order.data?.id || order.data?.order?.id;
  // Pharmacy accept
  await call(`/orders/pharmacy/${orderId}/respond`, 'POST', { action: 'ACCEPTED' }, pharmToken);
  // Rider accept
  await call(`/orders/rider/${orderId}/respond`, 'POST', { action: 'ACCEPTED' }, riderToken);
  // Rider update location
  await call(`/riders/${rId}/location`, 'PATCH', { lat: 28.62, lon: 77.21 }, riderToken);
  // Rider stage -> DELIVERED
  await call(`/orders/rider/${orderId}/stage`, 'PATCH', { stage: 'DELIVERED' }, riderToken);

  // Health & admin checks
  await call('/health', 'GET');
  await call('/admin/metrics', 'GET', null, adminToken);
  await call('/admin/audit/logs', 'GET', null, adminToken);

  // Cleanup: delete users
  await call(`/admin/users/${rId}`, 'DELETE', null, adminToken);
  await call(`/admin/users/${pId}`, 'DELETE', null, adminToken);
  await call(`/admin/users/${cId}`, 'DELETE', null, adminToken);

  console.log('\nE2E v12.3 complete\n');
})();
