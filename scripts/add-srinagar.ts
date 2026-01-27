import { PrismaClient, UserRole, Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";

async function main() {
  const prisma = new PrismaClient();

  const zoneName = "Srinagar Core";
  const existingZone = await prisma.serviceZone.findFirst({ where: { name: zoneName } });
  if (!existingZone) {
    const center = { lat: 34.0837, lng: 74.7973 };
    const delta = 0.03; // ~3km box
    const poly = [
      [center.lng - delta, center.lat - delta],
      [center.lng + delta, center.lat - delta],
      [center.lng + delta, center.lat + delta],
      [center.lng - delta, center.lat + delta],
      [center.lng - delta, center.lat - delta],
    ];
    await prisma.serviceZone.create({
      data: {
        name: zoneName,
        active: true,
        geojson: { type: "Polygon", coordinates: [poly] },
      },
    });
    console.log(`? Created zone: ${zoneName}`);
  } else {
    console.log(`?? Zone already exists: ${zoneName}`);
  }

  // Ensure a medicine exists for inventory
  const medicineSku = "SR-PARA-001";
  let medicine = await prisma.medicine.findFirst({ where: { sku: medicineSku } });
  if (!medicine) {
    medicine = await prisma.medicine.create({
      data: {
        name: "Paracetamol 500mg",
        sku: medicineSku,
        category: "NON_RX",
        rxType: "NONE",
        price: 45,
      },
    });
    console.log("? Created medicine Paracetamol 500mg");
  }

  // Pharmacy user
  const pharmacyEmail = "pharmacy.srinagar@test.com";
  const pharmacyPass = await bcrypt.hash("password123", 10);
  let pharmacy = await prisma.user.findUnique({ where: { email: pharmacyEmail } });
  if (!pharmacy) {
    pharmacy = await prisma.user.create({
      data: {
        email: pharmacyEmail,
        password: pharmacyPass,
        name: "Srinagar Pharmacy",
        role: UserRole.PHARMACY,
        status: "APPROVED",
        latitude: 34.0837,
        longitude: 74.7973,
        emailVerified: true,
      },
    });
    await prisma.partnerProfile.create({
      data: {
        userId: pharmacy.id,
        role: UserRole.PHARMACY,
        data: {
          pharmacyName: "Srinagar Health Mart",
          ownerName: "Dr. Shah",
          address: { line1: "Lal Chowk", city: "Srinagar", pin: "190001" },
          gstNumber: "GSTSRIN1234",
          drugLicenseNumber: "DL-SRIN-001",
          openingHours: "09:00-21:00",
        },
      },
    });
    console.log(`? Created pharmacy user ${pharmacyEmail}`);
  } else {
    if (pharmacy.latitude == null || pharmacy.longitude == null) {
      pharmacy = await prisma.user.update({
        where: { id: pharmacy.id },
        data: { latitude: 34.0837, longitude: 74.7973 },
      });
    }
    console.log(`?? Pharmacy user already exists: ${pharmacyEmail}`);
  }

  // Inventory for pharmacy + medicine
  await prisma.pharmacyInventory.upsert({
    where: { pharmacyId_medicineId: { pharmacyId: pharmacy.id, medicineId: medicine.id } },
    create: {
      pharmacyId: pharmacy.id,
      medicineId: medicine.id,
      stock: 120,
      discount: 0,
      mrp: new Prisma.Decimal(50),
      sellingPrice: new Prisma.Decimal(45),
    },
    update: {
      stock: 120,
      discount: 0,
      mrp: new Prisma.Decimal(50),
      sellingPrice: new Prisma.Decimal(45),
    },
  });
  console.log("? Seeded pharmacy inventory");

  // Rider user
  const riderEmail = "rider.srinagar@test.com";
  const riderPass = await bcrypt.hash("password123", 10);
  let rider = await prisma.user.findUnique({ where: { email: riderEmail } });
  if (!rider) {
    rider = await prisma.user.create({
      data: {
        email: riderEmail,
        password: riderPass,
        name: "Srinagar Rider",
        role: UserRole.RIDER,
        status: "ACTIVE",
        latitude: 34.0837,
        longitude: 74.7973,
        emailVerified: true,
      },
    });
    console.log(`? Created rider user ${riderEmail}`);
  } else {
    console.log(`?? Rider user already exists: ${riderEmail}`);
  }

  // Customer user
  const customerEmail = "customer.srinagar@test.com";
  const customerPass = await bcrypt.hash("password123", 10);
  let customer = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!customer) {
    customer = await prisma.user.create({
      data: {
        email: customerEmail,
        password: customerPass,
        name: "Srinagar Customer",
        role: UserRole.CUSTOMER,
        status: "APPROVED",
        latitude: 34.0837,
        longitude: 74.7973,
        emailVerified: true,
      },
    });
    console.log(`? Created customer user ${customerEmail}`);
  } else {
    console.log(`?? Customer user already exists: ${customerEmail}`);
  }

  // Customer default address
  const existingAddress = await prisma.userAddress.findFirst({
    where: { userId: customer.id, isDefault: true },
  });
  if (!existingAddress) {
    await prisma.userAddress.create({
      data: {
        userId: customer.id,
        label: "Home",
        name: "Srinagar Customer",
        phone: "9999999999",
        line1: "Lal Chowk",
        line2: "",
        city: "Srinagar",
        state: "JK",
        pin: "190001",
        landmark: "Clock Tower",
        isDefault: true,
      },
    });
    console.log("? Added customer address");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
