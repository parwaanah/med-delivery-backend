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
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function createUserIfNotExists(data) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
        console.log(`ℹ️ User already exists: ${data.email}`);
        return existing;
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password: passwordHash,
            role: data.role,
            status: data.status || 'APPROVED',
        },
    });
    console.log(`✅ Created user: ${data.email} (${data.role})`);
    return user;
}
async function main() {
    console.log('🌱 Starting safe, idempotent seed...');
    const superAdmin = await createUserIfNotExists({
        name: 'Super Admin',
        email: 'superadmin_live@example.com',
        password: 'superadmin123',
        role: client_1.UserRole.ADMIN,
        status: 'APPROVED',
    });
    const pharmacy1 = await createUserIfNotExists({
        name: 'MediCare Pharmacy',
        email: 'pharmacy1@med.com',
        password: 'password',
        role: client_1.UserRole.PHARMACY,
    });
    const pharmacy2 = await createUserIfNotExists({
        name: 'Wellness Drugs',
        email: 'pharmacy2@med.com',
        password: 'password',
        role: client_1.UserRole.PHARMACY,
    });
    const rider1 = await createUserIfNotExists({
        name: 'John Rider',
        email: 'rider1@med.com',
        password: 'password',
        role: client_1.UserRole.RIDER,
    });
    const rider2 = await createUserIfNotExists({
        name: 'Jane Courier',
        email: 'rider2@med.com',
        password: 'password',
        role: client_1.UserRole.RIDER,
    });
    const customer1 = await createUserIfNotExists({
        name: 'Alice Customer',
        email: 'customer1@med.com',
        password: 'password',
        role: client_1.UserRole.CUSTOMER,
    });
    const customer2 = await createUserIfNotExists({
        name: 'Bob Buyer',
        email: 'customer2@med.com',
        password: 'password',
        role: client_1.UserRole.CUSTOMER,
    });
    const existingOrders = await prisma.order.count();
    if (existingOrders === 0) {
        console.log('🧾 Creating sample orders...');
        await prisma.order.createMany({
            data: [
                {
                    customerId: customer1.id,
                    pharmacyId: pharmacy1.id,
                    riderId: rider1.id,
                    status: 'DELIVERED',
                    totalPrice: 1200,
                },
                {
                    customerId: customer2.id,
                    pharmacyId: pharmacy2.id,
                    riderId: rider2.id,
                    status: 'OUT_FOR_DELIVERY',
                    totalPrice: 800,
                },
                {
                    customerId: customer1.id,
                    pharmacyId: pharmacy2.id,
                    riderId: rider1.id,
                    status: 'PENDING',
                    totalPrice: 600,
                },
            ],
        });
        console.log('✅ Orders created.');
    }
    else {
        console.log(`ℹ️ Orders already exist (${existingOrders} found).`);
    }
    console.log('✅ Safe seed completed successfully!');
}
main()
    .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
