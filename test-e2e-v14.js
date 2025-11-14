// Requires node >= 18 (fetch builtin). Save as test-e2e-v14.js
const API = "http://localhost:3001";
const admin = { email: "superadmin_live@example.com", password: "superadmin123" };

// Test Modes
const PHARMACY_MODE = true;       // Direct order → specific pharmacy
const MEDICINE_MODE = true;       // Auto-route order via medicine stock matching

// Targets
const TARGET_PHARMACY_ID = 17;    // MUST exist
const TARGET_MEDICINE_ID = 1;     // MUST exist

//--------------------------------------------------------------------
async function req(path, method='GET', body=null, token=null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = txt; }
  console.log(`${method} ${path} -> ${res.status}`);
  return { ok: res.ok, status: res.status, data };
}

//--------------------------------------------------------------------
(async () => {
  console.log("\n=============================");
  console.log("  🚀 START E2E v14 — FULL SUITE");
  console.log("=============================\n");

  // 🔐 Admin login
  const alogin = await req('/auth/login', 'POST', admin);
  const adminToken = alogin.data?.accessToken || alogin.data?.access_token;
  if (!adminToken) { console.error("Admin login failed"); process.exit(1); }

  //--------------------------------------------------------------------
  // 👤 AUTO REGISTER TEST USERS
  console.log("\n=== Registering Test Users ===");

  await req('/auth/register', 'POST', {
    name: "Auto Customer V14",
    email: "auto_customer_v14@example.com",
    password: "123456",
    role: "CUSTOMER"
  });

  await req('/auth/register', 'POST', {
    name: "Auto Pharmacy V14",
    email: "auto_pharmacy_v14@example.com",
    password: "123456",
    role: "PHARMACY"
  });

  await req('/auth/register', 'POST', {
    name: "Auto Rider V14",
    email: "auto_rider_v14@example.com",
    password: "123456",
    role: "RIDER"
  });

  //--------------------------------------------------------------------
  // 🔍 Fetch & Approve
  const users = await req('/admin/users', 'GET', null, adminToken);
  const all = users.data?.users || [];

  const cust = all.find(u => u.email === "auto_customer_v14@example.com");
  const pharm = all.find(u => u.email === "auto_pharmacy_v14@example.com");
  const rider = all.find(u => u.email === "auto_rider_v14@example.com");

  if (cust) await req(`/admin/users/${cust.id}/approve`, 'PATCH', null, adminToken);
  if (pharm) await req(`/admin/users/${pharm.id}/approve`, 'PATCH', null, adminToken);
  if (rider) await req(`/admin/users/${rider.id}/approve`, 'PATCH', null, adminToken);

  //--------------------------------------------------------------------
  // 🔐 Logins
  const custTok = (await req('/auth/login','POST',{email:cust.email,password:"123456"})).data.accessToken;
  const pharmTok = (await req('/auth/login','POST',{email:pharm.email,password:"123456"})).data.accessToken;
  const riderTok = (await req('/auth/login','POST',{email:rider.email,password:"123456"})).data.accessToken;

  //--------------------------------------------------------------------
  //
  //  🧪 INVENTORY + MEDICINE TEST
  //
  //--------------------------------------------------------------------
  console.log("\n=== Inventory + Medicine Price Test ===");

  // check inventory of target pharmacy
  await req(`/pharmacies/inventory/${TARGET_PHARMACY_ID}`, 'GET', null, adminToken);

  // check surge-adjusted pricing
  await req(`/pharmacies/inventory/${TARGET_PHARMACY_ID}/${TARGET_MEDICINE_ID}/price`, 'GET', null, adminToken);

  //--------------------------------------------------------------------
  //
  // 🧪 SURGE ENGINE TEST
  //
  //--------------------------------------------------------------------
  console.log("\n=== Surge Engine Test ===");

  await req('/admin/surge/status', 'GET', null, adminToken);

  // override surge multiplier → then reset
  await req('/admin/surge/override','POST',{multiplier:3.0, reason:"E2E test"},adminToken);
  await req('/admin/surge/reset','POST',{},adminToken);

  //--------------------------------------------------------------------
  //
  // 🧪 GEOSURGE TEST
  //
  //--------------------------------------------------------------------
  console.log("\n=== GeoSurge Test ===");

  await req('/admin/geo-surge/status','GET',null,adminToken);

  //--------------------------------------------------------------------
  //
  // 🧪 ORDER TEST — DIRECT PHARMACY MODE
  //
  //--------------------------------------------------------------------
  if (PHARMACY_MODE) {
    console.log("\n=== Order Flow: Direct Pharmacy ===");

    const orderBody = {
      pharmacyId: TARGET_PHARMACY_ID,
      pickupLat: 28.621,
      pickupLon: 77.210,
      items: [
        { name:"Paracetamol", price:25, quantity:2 }
      ]
    };

    const o = await req('/orders','POST', orderBody, custTok);
    const orderId = o.data?.id || o.data?.order?.id;
    console.log("OrderID:", orderId);

    // pharmacy accept
    await req(`/orders/pharmacy/${orderId}/respond`, 'POST', {action:'ACCEPTED'}, pharmTok);

    // rider accept
    await req(`/orders/rider/${orderId}/respond`, 'POST', {action:'ACCEPTED'}, riderTok);

    // rider stages
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'REACHED_PHARMACY',location:{lat:28.62,lng:77.21}},riderTok);
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'PICKED_UP',location:{lat:28.62,lng:77.21}},riderTok);
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'DELIVERED',location:{lat:28.63,lng:77.22}},riderTok);
  }

  //--------------------------------------------------------------------
  //
  // 🧪 ORDER TEST — MEDICINE AUTO-ROUTING MODE
  //
  //--------------------------------------------------------------------
  if (MEDICINE_MODE) {
    console.log("\n=== Order Flow: Auto-Routed by Medicine Stock ===");

    const orderBody = {
      pickupLat: 28.621,
      pickupLon: 77.210,
      items: [
        { 
          name:"Paracetamol",
          medicineId: TARGET_MEDICINE_ID, 
          price:25, 
          quantity:1 
        }
      ]
    };

    const o = await req('/orders','POST', orderBody, custTok);
    const orderId = o.data?.id || o.data?.order?.id;
    console.log("OrderID:", orderId);

    // pharmacy respond (ONLY if assigned)
    await req(`/orders/pharmacy/${orderId}/respond`, 'POST', {action:'ACCEPTED'}, pharmTok);

    // rider respond
    await req(`/orders/rider/${orderId}/respond`, 'POST', {action:'ACCEPTED'}, riderTok);

    // rider stages
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'REACHED_PHARMACY',location:{lat:28.62,lng:77.21}},riderTok);
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'PICKED_UP',location:{lat:28.62,lng:77.21}},riderTok);
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'DELIVERED',location:{lat:28.63,lng:77.22}},riderTok);
  }

  //--------------------------------------------------------------------
  //
  // 🧪 SYSTEM CHECKS
  //
  //--------------------------------------------------------------------
  console.log("\n=== System Checks ===");

  await req('/health','GET');
  await req('/admin/metrics','GET',null,adminToken);
  await req('/admin/queue/status','GET',null,adminToken);

  //--------------------------------------------------------------------
  //
  // 🧹 CLEANUP — DELETE test users
  //
  //--------------------------------------------------------------------
  console.log("\n=== Cleanup ===");

  if (rider?.id) await req(`/admin/users/${rider.id}`, 'DELETE', null, adminToken);
  if (pharm?.id) await req(`/admin/users/${pharm.id}`, 'DELETE', null, adminToken);
  if (cust?.id) await req(`/admin/users/${cust.id}`, 'DELETE', null, adminToken);

  console.log("\n=============================");
  console.log("  🎉 E2E v14 COMPLETE");
  console.log("=============================\n");
})();
