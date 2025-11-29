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
const API = process.env.BASE_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin_live@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'superadmin123';
const http = axios_1.default.create({ baseURL: API, timeout: 10000 });
async function call(path, method = 'GET', body, token) {
    try {
        const r = await http.request({ url: path, method, data: body, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        console.log(`OK ${method} ${path} -> ${r.status}`);
        return r.data;
    }
    catch (err) {
        console.warn(`ERR ${method} ${path} -> ${err?.response?.status || 'ERR'} ${err?.response?.data ? JSON.stringify(err.response.data) : err.message}`);
        return null;
    }
}
async function main() {
    console.log('🔎 API smoke start');
    const admin = await call('/auth/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const adminToken = admin?.accessToken || admin?.access_token;
    await call('/health', 'GET');
    await call('/docs', 'GET');
    await call('/pharmacies', 'GET', null, adminToken);
    await call('/orders', 'GET', null);
    await call('/payments/admin/list', 'GET', null, adminToken).catch(() => { });
    await call('/admin/users/pending', 'GET', null, adminToken);
    await call('/payments/webhook', 'POST', { provider: 'razorpay', event: 'test.ping' });
    console.log('🔎 API smoke finished (check logs for any ERR entries)');
}
main().catch(e => { console.error(e); process.exit(1); });
