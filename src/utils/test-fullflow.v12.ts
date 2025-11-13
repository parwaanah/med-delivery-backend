import fetch from "node-fetch";
import chalk from "chalk";

const API = "http://localhost:3001";

interface Result {
  name: string;
  status: string;
  code: number;
}

const results: Result[] = [];

async function api(
  name: string,
  path: string,
  method = "GET",
  body?: any,
  token?: string
) {
  try {
    const res = await fetch(API + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    const ok = res.ok;
    results.push({
      name,
      status: ok ? chalk.green("✅ PASSED") : chalk.red("❌ FAILED"),
      code: res.status,
    });
    console.log(`${method} ${path} -> ${res.status}`);
    return { ok, status: res.status, data };
  } catch (e) {
    results.push({
      name,
      status: chalk.red("❌ ERROR"),
      code: 0,
    });
    console.error(`❌ ${name} failed:`, e);
    return { ok: false, data: {} };
  }
}

(async () => {
  console.log(chalk.cyan("\n🚀 Starting Full E2E Backend Test v12.1\n"));

  // Step 1️⃣ Register users
  const customer = await api(
    "Register Customer",
    "/auth/register",
    "POST",
    {
      name: "Auto Customer",
      email: "auto_customer_v12_1@example.com",
      password: "123456",
      role: "CUSTOMER",
    }
  );

  const pharmacy = await api(
    "Register Pharmacy",
    "/auth/register",
    "POST",
    {
      name: "Auto Pharmacy",
      email: "auto_pharmacy_v12_1@example.com",
      password: "123456",
      role: "PHARMACY",
    }
  );

  const rider = await api(
    "Register Rider",
    "/auth/register",
    "POST",
    {
      name: "Auto Rider",
      email: "auto_rider_v12_1@example.com",
      password: "123456",
      role: "RIDER",
    }
  );

  // Step 2️⃣ Admin login
  const adminLogin = await api(
    "Admin Login",
    "/auth/login",
    "POST",
    {
      email: "superadmin_live@example.com",
      password: "superadmin123",
    }
  );
  const adminToken =
    adminLogin.data.access_token || adminLogin.data.accessToken;

  // Step 3️⃣ Approve users
  const cId = customer.data?.user?.id || 0;
  const pId = pharmacy.data?.user?.id || 0;
  const rId = rider.data?.user?.id || 0;

  await api("Approve Customer", `/admin/users/${cId}/approve`, "PATCH", null, adminToken);
  await api("Approve Pharmacy", `/admin/users/${pId}/approve`, "PATCH", null, adminToken);
  await api("Approve Rider", `/admin/users/${rId}/approve`, "PATCH", null, adminToken);

  // Step 4️⃣ User logins
  const custLogin = await api("Customer Login", "/auth/login", "POST", {
    email: "auto_customer_v12_1@example.com",
    password: "123456",
  });
  const pharmLogin = await api("Pharmacy Login", "/auth/login", "POST", {
    email: "auto_pharmacy_v12_1@example.com",
    password: "123456",
  });
  const riderLogin = await api("Rider Login", "/auth/login", "POST", {
    email: "auto_rider_v12_1@example.com",
    password: "123456",
  });

  const custToken = custLogin.data.access_token;
  const pharmToken = pharmLogin.data.access_token;
  const riderToken = riderLogin.data.access_token;

  // Step 5️⃣ Customer places order
  const order = await api(
    "Create Order",
    "/orders",
    "POST",
    {
      pharmacyId: pId,
      items: [
        { name: "Paracetamol", quantity: 2, price: 20 },
        { name: "Vitamin C", quantity: 1, price: 30 },
      ],
    },
    custToken
  );

  const orderId = order.data?.id || order.data?.order?.id || 1;

  // Step 6️⃣ Pharmacy accepts order
  await api("Pharmacy Accept Order", `/pharmacies/orders/${orderId}/accept`, "PATCH", null, pharmToken);

  // Step 7️⃣ Rider accepts order
  await api("Rider Accept Order", `/riders/orders/${orderId}/accept`, "PATCH", null, riderToken);

  // Step 8️⃣ Rider updates location
  await api("Rider Update Location", `/riders/location`, "PATCH", { lat: 19.07, lng: 72.88 }, riderToken);

  // Step 9️⃣ Rider marks delivered
  await api("Rider Mark Delivered", `/riders/orders/${orderId}/delivered`, "PATCH", null, riderToken);

  // Step 🔟 Health & Metrics
  await api("System Health", "/health", "GET");
  await api("Admin Metrics", "/admin/metrics", "GET", null, adminToken);
  await api("Audit Logs", "/admin/audit/logs", "GET", null, adminToken);

  // Step 🧹 Delete users
  await api("Delete Rider", `/admin/users/${rId}`, "DELETE", null, adminToken);
  await api("Delete Pharmacy", `/admin/users/${pId}`, "DELETE", null, adminToken);
  await api("Delete Customer", `/admin/users/${cId}`, "DELETE", null, adminToken);

  // Final Summary
  console.log(chalk.yellow("\n📊 TEST SUMMARY (v12.1)\n"));
  console.table(
    results.map((r) => ({
      Test: r.name,
      Status: r.status,
      Code: r.code,
    }))
  );

  console.log(chalk.cyan("\n✅ E2E Flow Completed — Results Above\n"));
})();
