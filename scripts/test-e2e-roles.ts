import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";

const API = process.env.API_URL || "http://backend:3001";
const prisma = new PrismaClient();

async function call(path: string, method = "GET", body?: any, token?: string) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {}
  console.log(`${method} ${path} -> ${res.status}`);
  return { status: res.status, data };
}

async function waitForHealth(retries = 20, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(API + "/health");
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Backend not reachable");
}

async function run() {
  console.log("\nStarting role E2E checks\n");

  await waitForHealth();

  const stamp = Date.now();
  const adminLogin = await call("/auth/login", "POST", {
    email: "superadmin_live@example.com",
    password: "superadmin123",
  });
  const adminToken = adminLogin.data?.accessToken || adminLogin.data?.access_token;

  if (!adminToken) throw new Error("Admin login failed");

  const customerEmail = `e2e_customer_${stamp}@example.com`;
  const pharmacyEmail = `e2e_pharmacy_${stamp}@example.com`;
  const riderEmail = `e2e_rider_${stamp}@example.com`;

  const cust = await call("/auth/register", "POST", {
    name: "E2E Customer",
    email: customerEmail,
    password: "Testpass123",
    role: "CUSTOMER",
  });
  const pharm = await call("/auth/register", "POST", {
    name: "E2E Pharmacy",
    email: pharmacyEmail,
    password: "Testpass123",
    role: "PHARMACY",
  });
  const rider = await call("/auth/register", "POST", {
    name: "E2E Rider",
    email: riderEmail,
    password: "Testpass123",
    role: "RIDER",
  });

  const cId = cust.data?.user?.id || cust.data?.id;
  const pId = pharm.data?.user?.id || pharm.data?.id;
  const rId = rider.data?.user?.id || rider.data?.id;

  // Mark emails verified for e2e so login passes verification gate
  await prisma.user.updateMany({
    where: { id: { in: [cId, pId, rId].filter(Boolean) as number[] } },
    data: { emailVerified: true, otpCode: null, otpExpiresAt: null },
  });

  await call(`/admin/users/${cId}/approve`, "PATCH", null, adminToken);
  await call(`/admin/users/${pId}/approve`, "PATCH", null, adminToken);
  await call(`/admin/users/${rId}/approve`, "PATCH", null, adminToken);

  const custLogin = await call("/auth/login", "POST", {
    email: customerEmail,
    password: "Testpass123",
  });
  const pharmLogin = await call("/auth/login", "POST", {
    email: pharmacyEmail,
    password: "Testpass123",
  });
  const riderLogin = await call("/auth/login", "POST", {
    email: riderEmail,
    password: "Testpass123",
  });

  const custToken = custLogin.data?.accessToken || custLogin.data?.access_token;
  const pharmToken = pharmLogin.data?.accessToken || pharmLogin.data?.access_token;
  const riderToken = riderLogin.data?.accessToken || riderLogin.data?.access_token;

  // Customer basic endpoints
  await call("/users/me", "GET", null, custToken);
  await call("/notifications", "GET", null, custToken);

  // Pharmacy basic endpoints
  await call("/users/me", "GET", null, pharmToken);
  await call("/profile/me", "GET", null, pharmToken);
  await call("/profile/status", "GET", null, pharmToken);

  // Rider basic endpoints
  await call("/users/me", "GET", null, riderToken);
  await call("/rider/availability", "PATCH", { state: "ONLINE" }, riderToken);

  // Admin access checks
  await call("/admin/users/pending/PHARMACY", "GET", null, adminToken);
  await call("/admin/orders/escalated", "GET", null, adminToken);

  // Cleanup
  await call(`/admin/users/${rId}`, "DELETE", null, adminToken);
  await call(`/admin/users/${pId}`, "DELETE", null, adminToken);
  await call(`/admin/users/${cId}`, "DELETE", null, adminToken);

  console.log("\nRole E2E checks complete\n");
}

run()
  .catch((err) => {
    console.error("E2E role tests failed:", err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
