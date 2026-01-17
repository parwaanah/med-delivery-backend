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
async function createUserIfNotExists(data) {
    const existing = await prisma.user.findUnique({
        where: { email: data.email },
    });
    if (existing) {
        console.log(`ℹ️ Admin already exists: ${data.email}`);
        return existing;
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: passwordHash,
            role: data.role,
            status: "APPROVED",
            emailVerified: true,
        },
    });
    console.log(`✅ Created admin: ${data.email}`);
    return user;
}
async function main() {
    console.log("🌱 Admin seed started...");
    await createUserIfNotExists({
        name: "Super Admin",
        email: "superadmin_live@example.com",
        password: "superadmin123",
        role: client_1.UserRole.ADMIN,
    });
    console.log("✅ Admin seed completed");
}
main()
    .catch((e) => {
    console.error("❌ Admin seed error:", e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
