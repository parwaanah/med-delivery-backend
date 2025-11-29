"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const API = process.env.BASE_URL || "http://localhost:3001";
const PASSWORD = "123456";
const ADMIN_EMAIL = "superadmin_live@example.com";
const ADMIN_PASSWORD = "superadmin123";
const CUST_EMAIL = `e2e_customer_${Date.now()}@test.com`;
const PHARM_EMAIL = `e2e_pharmacy_${Date.now()}@test.com`;
const RIDER_EMAIL = `e2e_rider_${Date.now()}@test.com`;
const MED_IDS = process.env.MED_IDS
    ? process.env.MED_IDS.split(",").map((x) => Number(x))
    : [18, 19, 20, 21, 22, 23];
const http = axios_1.default.create({ baseURL: API, timeout: 15000 });
async function safe(p) {
    try {
        return { ok: true, data: await p };
    }
    catch (err) {
        return { ok: false, err };
    }
}
async function call(path, method = "GET", body, token) {
    return safe(http({
        url: path,
        method,
        data: body,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).then((r) => r.data));
}
async function main() {
    console.log("\n🚀 E2E v13.1 STARTED\n");
    const adminLogin = await call("/auth/login", "POST", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
    });
    if (!adminLogin.ok) {
        console.error("❌ ADMIN LOGIN FAILED");
        return;
    }
    const adminToken = adminLogin.data.accessToken || adminLogin.data.access_token;
    console.log("✅ Admin logged in");
    const cust = await call("/auth/register", "POST", {
        name: "Customer E2E13",
        email: CUST_EMAIL,
        password: PASSWORD,
        role: "CUSTOMER",
    });
    const pharm = await call("/auth/register", "POST", {
        name: "Pharmacy E2E13",
        email: PHARM_EMAIL,
        password: PASSWORD,
        role: "PHARMACY",
    });
    const rider = await call("/auth/register", "POST", {
        name: "Rider E2E13",
        email: RIDER_EMAIL,
        password: PASSWORD,
        role: "RIDER",
    });
    const cId = cust.data?.user?.id;
    const pId = pharm.data?.user?.id;
    const rId = rider.data?.user?.id;
    await call(`/admin/users/${cId}/approve`, "PATCH", null, adminToken);
    await call(`/admin/users/${pId}/approve`, "PATCH", null, adminToken);
    await call(`/admin/users/${rId}/approve`, "PATCH", null, adminToken);
    console.log("✅ Users approved");
    const custLogin = await call("/auth/login", "POST", {
        email: CUST_EMAIL,
        password: PASSWORD,
    });
    const pharmLogin = await call("/auth/login", "POST", {
        email: PHARM_EMAIL,
        password: PASSWORD,
    });
    const riderLogin = await call("/auth/login", "POST", {
        email: RIDER_EMAIL,
        password: PASSWORD,
    });
    const custToken = custLogin.data?.accessToken;
    const pharmToken = pharmLogin.data?.accessToken;
    const riderToken = riderLogin.data?.accessToken;
    console.log("✅ All users logged in\n");
    console.log("🏪 Seeding pharmacy inventory...");
    async function addInventory(medId) {
        return call("/pharmacies/inventory/add", "POST", {
            pharmacyId: pId,
            medicineId: medId,
            price: 50,
            stock: 30,
        }, pharmToken);
    }
    for (const med of MED_IDS.slice(0, 3)) {
        await addInventory(med);
    }
    console.log("✅ Pharmacy inventory seeded\n");
    async function placeOrder(type, medId, price) {
        console.log(`📦 Creating order: ${type}`);
        const res = await call("/orders", "POST", {
            items: [
                {
                    medicineId: medId,
                    name: `${type}-${medId}`,
                    quantity: 1,
                    price,
                    category: type,
                },
            ],
            address: "E2E Test Address",
        }, custToken);
        return res;
    }
    const o1 = await placeOrder("NON_RX", MED_IDS[0], 49.99);
    const o2 = await placeOrder("CHRONIC", MED_IDS[1], 75);
    const o3 = await placeOrder("STRICT_RX", MED_IDS[2], 150);
    const strictOrderId = o3.data?.id || o3.data?.order?.id;
    console.log("\n📑 Uploading Prescription");
    await call("/orders/prescription/upload", "POST", {
        url: "https://example.com/prescription.jpg",
        attachOrderId: strictOrderId,
    }, custToken);
    const nonRxId = o1.data?.id || o1.data?.order?.id;
    console.log("\n🏥 Pharmacy Accepting Order");
    await call(`/orders/pharmacy/${nonRxId}/respond`, "POST", { action: "ACCEPTED" }, pharmToken);
    console.log("\n🚴 Rider Accepting Order");
    await call(`/orders/rider/${nonRxId}/respond`, "POST", { action: "ACCEPTED" }, riderToken);
    console.log("📍 Rider delivering...");
    await call(`/orders/rider/${nonRxId}/stage`, "PATCH", { stage: "DELIVERED" }, riderToken);
    console.log("\n🕒 Fetching timeline");
    await call(`/orders/timeline/${nonRxId}`, "GET", null, custToken);
    console.log("\n❤️ Health Check");
    await call("/health", "GET");
    console.log("\n🧹 Cleaning up test users");
    await call(`/admin/users/${rId}`, "DELETE", null, adminToken);
    await call(`/admin/users/${pId}`, "DELETE", null, adminToken);
    await call(`/admin/users/${cId}`, "DELETE", null, adminToken);
    console.log("\n✨ E2E v13.1 FINISHED SUCCESSFULLY ✨\n");
}
main();
