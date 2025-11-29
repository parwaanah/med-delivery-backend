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
const prisma = new client_1.PrismaClient();
const HASH_ROUNDS = 10;
async function createUser(email, role, name) {
    const password = await bcrypt.hash("loadtest123", HASH_ROUNDS);
    return prisma.user.create({
        data: {
            email,
            password,
            name,
            role,
            status: "ACTIVE",
            latitude: 19.0760,
            longitude: 72.8777
        }
    });
}
async function main() {
    console.log("⚙ Creating loadtest users with correct hash…");
    await createUser("superadmin_live@example.com", client_1.UserRole.ADMIN, "Super Admin");
    await createUser("lt_customer@test.com", client_1.UserRole.CUSTOMER, "Load Customer");
    await createUser("lt_pharmacy@test.com", client_1.UserRole.PHARMACY, "Load Pharmacy");
    await createUser("lt_rider@test.com", client_1.UserRole.RIDER, "Load Rider");
    console.log("✅ All loadtest users created with correct registered password.");
}
main().finally(() => prisma.$disconnect());
