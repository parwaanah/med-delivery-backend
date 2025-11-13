// Requires node >= 18 (fetch builtin). Save as test-e2e-v13.js
const API = "http://localhost:3001";
const admin = { email: "superadmin_live@example.com", password: "superadmin123" };

// Mode
const MODE = "PHARMACY"; // or "MEDICINE"
const TARGET_PHARMACY_ID = 17;
const TARGET_MEDICINE_ID = 1;

async function req(path, method='GET', body=null, token=null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = text; }
  console.log(`${method} ${path} -> ${res.status}`);
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  console.log("\n=== START E2E v13 ===\n");
  const alogin = await req('/auth/login','POST',admin);
  const adminToken = alogin.data?.accessToken || alogin.data?.access_token;
  if (!adminToken) { console.error('Admin login failed'); process.exit(1);}

  // Register
  await req('/auth/register','POST',{name:"Auto Customer", email:"auto_customer_v13@example.com", password:"123456", role:"CUSTOMER"});
  await req('/auth/register','POST',{name:"Auto Pharmacy", email:"auto_pharmacy_v13@example.com", password:"123456", role:"PHARMACY"});
  await req('/auth/register','POST',{name:"Auto Rider", email:"auto_rider_v13@example.com", password:"123456", role:"RIDER"});

  // fetch users (admin)
  const users = await req('/admin/users','GET',null,adminToken);
  const ulist = users.data?.users || users.data || [];
  const cust = ulist.find(u => u.email === "auto_customer_v13@example.com");
  const pharm = ulist.find(u => u.email === "auto_pharmacy_v13@example.com");
  const rider = ulist.find(u => u.email === "auto_rider_v13@example.com");

  let pId = pharm?.id;
  if (MODE === 'PHARMACY') pId = TARGET_PHARMACY_ID;

  if (cust) await req(`/admin/users/${cust.id}/approve`,'PATCH',null,adminToken);
  if (pId)  await req(`/admin/users/${pId}/approve`,'PATCH',null,adminToken);
  if (rider) await req(`/admin/users/${rider.id}/approve`,'PATCH',null,adminToken);

  // logins
  const cl = await req('/auth/login','POST',{email:"auto_customer_v13@example.com",password:"123456"});
  const phl = await req('/auth/login','POST',{email:"auto_pharmacy_v13@example.com",password:"123456"});
  const rl = await req('/auth/login','POST',{email:"auto_rider_v13@example.com",password:"123456"});

  const custToken = cl.data?.accessToken || cl.data?.access_token;
  const pharmToken = phl.data?.accessToken || phl.data?.access_token;
  const riderToken = rl.data?.accessToken || rl.data?.access_token;

  // create order
  let orderBody;
  if (MODE==='PHARMACY') {
    orderBody = { items:[{name:'Paracetamol',price:25,quantity:2}], pharmacyId: pId, pickupLat:28.621, pickupLon:77.210 };
  } else {
    orderBody = { items:[{name:'Paracetamol', medicineId: TARGET_MEDICINE_ID, price:25, quantity:2}], pickupLat:28.621, pickupLon:77.210 };
  }
  const ord = await req('/orders','POST', orderBody, custToken);
  const orderId = ord.data?.id || ord.data?.order?.id;
  console.log('OrderId:', orderId);

  // pharmacy accept
  if (pharmToken) await req(`/orders/pharmacy/${orderId}/respond`,'POST',{action:'ACCEPTED'},pharmToken);

  // rider accept
  if (riderToken) await req(`/orders/rider/${orderId}/respond`,'POST',{action:'ACCEPTED'},riderToken);

  // rider stages
  if (riderToken) {
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'REACHED_PHARMACY', location:{lat:28.62,lng:77.21}},riderToken);
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'PICKED_UP', location:{lat:28.62,lng:77.21}},riderToken);
    await req(`/orders/rider/${orderId}/stage`,'PATCH',{stage:'DELIVERED', location:{lat:28.63,lng:77.22}},riderToken);
  }

  // system checks
  await req('/health','GET');
  await req('/admin/metrics','GET',null,adminToken);
  await req('/admin/queue/status','GET',null,adminToken);

  // Cleanup if possible - delete by admin (IDs may be null if using a target pharmacy)
  if (rider?.id) await req(`/admin/users/${rider.id}`,'DELETE',null,adminToken);
  if (pharm?.id && MODE!=='PHARMACY') await req(`/admin/users/${pharm.id}`,'DELETE',null,adminToken);
  if (cust?.id) await req(`/admin/users/${cust.id}`,'DELETE',null,adminToken);

  console.log("\n=== E2E Complete ===\n");
})();
