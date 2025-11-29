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
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
async function main() {
    const prisma = new client_1.PrismaClient();
    console.log("🚀 Creating Load Test Users...");
    const PASSWORD = "loadtest123";
    const hash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.upsert({
        where: { email: "lt_customer@test.com" },
        update: {},
        create: {
            name: "LoadTest Customer",
            email: "lt_customer@test.com",
            password: hash,
            role: "CUSTOMER",
            status: "APPROVED",
        },
    });
    await prisma.user.upsert({
        where: { email: "lt_pharmacy@test.com" },
        update: {},
        create: {
            name: "LoadTest Pharmacy",
            email: "lt_pharmacy@test.com",
            password: hash,
            role: "PHARMACY",
            status: "APPROVED",
        },
    });
    await prisma.user.upsert({
        where: { email: "lt_rider@test.com" },
        update: {},
        create: {
            name: "LoadTest Rider",
            email: "lt_rider@test.com",
            password: hash,
            role: "RIDER",
            status: "APPROVED",
        },
    });
    console.log("✅ Load Test Users Created & Auto-Approved");
    console.log({
        CUSTOMER: "lt_customer@test.com",
        PHARMACY: "lt_pharmacy@test.com",
        RIDER: "lt_rider@test.com",
        PASSWORD,
    });
    await prisma.$disconnect();
}
main().catch((e) => {
    console.error("❌ Error creating load test users:", e);
    process.exit(1);
});
