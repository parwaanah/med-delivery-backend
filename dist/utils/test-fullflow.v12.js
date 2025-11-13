"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const chalk_1 = __importDefault(require("chalk"));
const API = "http://localhost:3001";
const results = [];
async function api(name, path, method = "GET", body, token) {
    try {
        const res = await (0, node_fetch_1.default)(API + path, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
            data = text;
        }
        const ok = res.ok;
        results.push({
            name,
            status: ok ? chalk_1.default.green("✅ PASSED") : chalk_1.default.red("❌ FAILED"),
            code: res.status,
        });
        console.log(`${method} ${path} -> ${res.status}`);
        return { ok, status: res.status, data };
    }
    catch (e) {
        results.push({
            name,
            status: chalk_1.default.red("❌ ERROR"),
            code: 0,
        });
        console.error(`❌ ${name} failed:`, e);
        return { ok: false, data: {} };
    }
}
(async () => {
    console.log(chalk_1.default.cyan("\n🚀 Starting Full E2E Backend Test v12.1\n"));
    const customer = await api("Register Customer", "/auth/register", "POST", {
        name: "Auto Customer",
        email: "auto_customer_v12_1@example.com",
        password: "123456",
        role: "CUSTOMER",
    });
    const pharmacy = await api("Register Pharmacy", "/auth/register", "POST", {
        name: "Auto Pharmacy",
        email: "auto_pharmacy_v12_1@example.com",
        password: "123456",
        role: "PHARMACY",
    });
    const rider = await api("Register Rider", "/auth/register", "POST", {
        name: "Auto Rider",
        email: "auto_rider_v12_1@example.com",
        password: "123456",
        role: "RIDER",
    });
    const adminLogin = await api("Admin Login", "/auth/login", "POST", {
        email: "superadmin_live@example.com",
        password: "superadmin123",
    });
    const adminToken = adminLogin.data.access_token || adminLogin.data.accessToken;
    const cId = customer.data?.user?.id || 0;
    const pId = pharmacy.data?.user?.id || 0;
    const rId = rider.data?.user?.id || 0;
    await api("Approve Customer", `/admin/users/${cId}/approve`, "PATCH", null, adminToken);
    await api("Approve Pharmacy", `/admin/users/${pId}/approve`, "PATCH", null, adminToken);
    await api("Approve Rider", `/admin/users/${rId}/approve`, "PATCH", null, adminToken);
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
    const order = await api("Create Order", "/orders", "POST", {
        pharmacyId: pId,
        items: [
            { name: "Paracetamol", quantity: 2, price: 20 },
            { name: "Vitamin C", quantity: 1, price: 30 },
        ],
    }, custToken);
    const orderId = order.data?.id || order.data?.order?.id || 1;
    await api("Pharmacy Accept Order", `/pharmacies/orders/${orderId}/accept`, "PATCH", null, pharmToken);
    await api("Rider Accept Order", `/riders/orders/${orderId}/accept`, "PATCH", null, riderToken);
    await api("Rider Update Location", `/riders/location`, "PATCH", { lat: 19.07, lng: 72.88 }, riderToken);
    await api("Rider Mark Delivered", `/riders/orders/${orderId}/delivered`, "PATCH", null, riderToken);
    await api("System Health", "/health", "GET");
    await api("Admin Metrics", "/admin/metrics", "GET", null, adminToken);
    await api("Audit Logs", "/admin/audit/logs", "GET", null, adminToken);
    await api("Delete Rider", `/admin/users/${rId}`, "DELETE", null, adminToken);
    await api("Delete Pharmacy", `/admin/users/${pId}`, "DELETE", null, adminToken);
    await api("Delete Customer", `/admin/users/${cId}`, "DELETE", null, adminToken);
    console.log(chalk_1.default.yellow("\n📊 TEST SUMMARY (v12.1)\n"));
    console.table(results.map((r) => ({
        Test: r.name,
        Status: r.status,
        Code: r.code,
    })));
    console.log(chalk_1.default.cyan("\n✅ E2E Flow Completed — Results Above\n"));
})();
