// test-e2e-v16.js
// PURPOSE: Test Escalation Queue (1-minute delay)

const API = "http://localhost:3001";
const admin = { email: "superadmin_live@example.com", password: "superadmin123" };

async function req(path, method='GET', body=null, token=null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch(e) {}
  console.log(`${method} ${path} -> ${res.status}`);
  return { ok: res.ok, status: res.status, data };
}

(async () => {
  console.log("\n=========================================");
  console.log("    🚀 START E2E TEST v16 — ESCALATION");
  console.log("=========================================\n");

  // Admin login
  const a = await req("/auth/login", "POST", admin);
  const adminToken = a.data.accessToken;

  // Create test users
  console.log("\n=== Creating test users ===");
  const u1 = await req("/auth/register", "POST", { name:"E2E Cust", email:"e2e_cust16@example.com", password:"123456", role:"CUSTOMER" });
  const u2 = await req("/auth/register", "POST", { name:"E2E Pharm", email:"e2e_pharm16@example.com", password:"123456", role:"PHARMACY" });
  const u3 = await req("/auth/register", "POST", { name:"E2E Rider", email:"e2e_rider16@example.com", password:"123456", role:"RIDER" });

  const users = await req("/admin/users", "GET", null, adminToken);
  const list = users.data.users;
  const cust = list.find(u => u.email === "e2e_cust16@example.com");
  const pharm = list.find(u => u.email === "e2e_pharm16@example.com");
  const rider = list.find(u => u.email === "e2e_rider16@example.com");

  await req(`/admin/users/${cust.id}/approve`, "PATCH", null, adminToken);
  await req(`/admin/users/${pharm.id}/approve`, "PATCH", null, adminToken);
  await req(`/admin/users/${rider.id}/approve`, "PATCH", null, adminToken);

  // Logins
  const cl = await req("/auth/login", "POST", { email:cust.email, password:"123456" });
  const ph = await req("/auth/login", "POST", { email:pharm.email, password:"123456" });
  const rl = await req("/auth/login", "POST", { email:rider.email, password:"123456" });

  const custToken = cl.data.accessToken;
  const pharmToken = ph.data.accessToken;
  const riderToken = rl.data.accessToken;

  console.log("\n=== Create ORDER (Pharmacy accepts, Rider ignores) ===");

  const order = await req("/orders", "POST", {
    items:[{ name:"Paracetamol", price:20, quantity:1 }],
    pharmacyId: pharm.id,
    pickupLat:28.61,
    pickupLon:77.21
  }, custToken);

  const orderId = order.data.id;
  console.log("Order ID:", orderId);

  // Pharmacy ACCEPTS
  await req(`/orders/pharmacy/${orderId}/respond`, "POST", { action:"ACCEPTED" }, pharmToken);

  // Rider does NOTHING (testing escalation)

  console.log("\n⏳ WAIT 70 seconds for ESCALATION_MINUTES=1 ...");
  await new Promise(res => setTimeout(res, 70000));

  console.log("\n=== Check admin notifications ===");
  const notes = await req(`/notifications`, "GET", null, adminToken);

  console.log("\nAdmin Notifications:");
  console.log(notes.data);

  console.log("\n=== Cleanup ===");
  await req(`/admin/users/${cust.id}`, "DELETE", null, adminToken);
  await req(`/admin/users/${pharm.id}`, "DELETE", null, adminToken);
  await req(`/admin/users/${rider.id}`, "DELETE", null, adminToken);

  console.log("\n=========================================");
  console.log("   🎉 E2E TEST v16 COMPLETE (ESCALATION)");
  console.log("=========================================\n");

})();
