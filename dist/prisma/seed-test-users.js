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
async function seed() {
    const users = [
        { name: 'Test Pharmacy Auto2', email: 'pharmacy_auto2@example.com', password: 'pharma123', role: client_1.UserRole.PHARMACY },
        { name: 'Test Rider Auto2', email: 'rider_auto2@example.com', password: 'rider123', role: client_1.UserRole.RIDER },
        { name: 'Test Customer Auto2', email: 'customer_auto2@example.com', password: 'customer123', role: client_1.UserRole.CUSTOMER },
    ];
    for (const u of users) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (!existing) {
            const hash = await bcrypt.hash(u.password, 10);
            await prisma.user.create({
                data: {
                    name: u.name,
                    email: u.email,
                    password: hash,
                    role: u.role,
                    status: 'APPROVED',
                },
            });
            console.log(`✅ Created user: ${u.email}`);
        }
        else {
            console.log(`ℹ️ User already exists: ${u.email}`);
        }
    }
    await prisma.$disconnect();
}
seed();
