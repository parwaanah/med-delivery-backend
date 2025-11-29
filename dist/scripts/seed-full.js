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
async function hash(pw) {
    return bcrypt.hash(pw, 10);
}
async function upsertUser(data) {
    const { email, name, passwordPlain, role, lat = null, lng = null, forceApprove = false } = data;
    const hashed = await hash(passwordPlain);
    const status = role === client_1.UserRole.CUSTOMER || forceApprove ? 'APPROVED' : 'PENDING';
    return prisma.user.upsert({
        where: { email },
        update: { name, password: hashed, role, status, latitude: lat, longitude: lng, deletedAt: null },
        create: { name, email, password: hashed, role, status, latitude: lat, longitude: lng },
    });
}
async function upsertMedicine(name, sku) {
    if (sku) {
        return prisma.medicine.upsert({
            where: { sku },
            update: { name, sku },
            create: { name, sku },
        });
    }
    else {
        const found = await prisma.medicine.findFirst({ where: { name } });
        if (found)
            return found;
        return prisma.medicine.create({ data: { name, sku: null } });
    }
}
async function upsertInventory(pharmacyId, medicineId, mrp, stock) {
    const sellingPrice = mrp - 5;
    return prisma.pharmacyInventory.upsert({
        where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
        update: { mrp, sellingPrice, discount: 10, stock },
        create: { pharmacyId, medicineId, mrp, sellingPrice, discount: 10, stock },
    });
}
async function main() {
    console.log('📦 Starting seed script');
    const admin = await upsertUser({
        email: 'superadmin_live@example.com',
        name: 'Super Admin',
        passwordPlain: 'superadmin123',
        role: client_1.UserRole.ADMIN,
        forceApprove: true,
    });
    const customer1 = await upsertUser({
        email: 'customer@example.com',
        name: 'Test Customer',
        passwordPlain: 'customer123',
        role: client_1.UserRole.CUSTOMER,
        lat: 34.0837,
        lng: 74.7973,
    });
    const customer2 = await upsertUser({
        email: 'alice.customer@example.com',
        name: 'Alice Customer',
        passwordPlain: 'customer123',
        role: client_1.UserRole.CUSTOMER,
        lat: 34.09,
        lng: 74.80,
    });
    const pharmaciesData = [
        { email: 'cureplus.lalchowk@example.com', name: 'CurePlus Pharmacy – Lal Chowk', lat: 34.0700, lng: 74.7950 },
        { email: 'medico.rajbagh@example.com', name: 'Medico Srinagar – Rajbagh', lat: 34.0800, lng: 74.7850 },
        { email: 'citymed.hyderpora@example.com', name: 'CityMed Wellness – Hyderpora', lat: 34.0880, lng: 74.7955 },
        { email: 'healthfirst.bemina@example.com', name: 'HealthFirst Pharmacy – Bemina', lat: 34.0250, lng: 74.8050 },
        { email: 'medx.nishat@example.com', name: 'MedX Care – Nishat', lat: 34.0860, lng: 74.8160 },
        { email: 'lifeline.nowgam@example.com', name: 'LifeLine Pharmacy – Nowgam', lat: 34.0820, lng: 74.8400 },
    ];
    const pharmacies = [];
    for (const p of pharmaciesData) {
        pharmacies.push(await upsertUser({
            email: p.email,
            name: p.name,
            passwordPlain: 'pharmacy123',
            role: client_1.UserRole.PHARMACY,
            lat: p.lat,
            lng: p.lng,
        }));
    }
    const riders = [];
    for (let i = 1; i <= 10; i++) {
        riders.push(await upsertUser({
            email: `rider${i}@example.com`,
            name: `Rider ${i}`,
            passwordPlain: 'rider123',
            role: client_1.UserRole.RIDER,
            lat: 34.07 + Math.random() * 0.03,
            lng: 74.79 + Math.random() * 0.03,
        }));
    }
    const medNames = [
        'Paracetamol 500mg',
        'Ibuprofen 200mg',
        'Azithromycin 500mg',
        'Cetirizine 10mg',
        'Omeprazole 20mg',
        'Metformin 500mg',
        'Amoxicillin 500mg',
        'Loratadine 10mg',
        'Aspirin 75mg',
        'Cough Syrup 100ml',
        'Vitamin C 500mg',
        'Multivitamin Syrup 200ml',
    ];
    const meds = [];
    for (const name of medNames) {
        meds.push(await upsertMedicine(name));
    }
    for (let i = 0; i < pharmacies.length; i++) {
        const p = pharmacies[i];
        for (let j = 0; j < 6; j++) {
            const med = meds[(i * 3 + j) % meds.length];
            const mrp = 50 + (i + j) * 7;
            const stock = 5 + ((i + j) % 10);
            await upsertInventory(p.id, med.id, mrp, stock);
        }
    }
    console.log('✅ Seed complete');
    console.log('Admin:', admin.email);
}
main().catch((e) => {
    console.error('Seed error', e);
    process.exit(1);
});
