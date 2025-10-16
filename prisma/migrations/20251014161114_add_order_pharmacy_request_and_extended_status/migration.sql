-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'awaiting_pharmacy_acceptance';
ALTER TYPE "OrderStatus" ADD VALUE 'rejected';

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_pharmacyId_fkey";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "pharmacyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OrderPharmacyRequest" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "pharmacyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPharmacyRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPharmacyRequest" ADD CONSTRAINT "OrderPharmacyRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPharmacyRequest" ADD CONSTRAINT "OrderPharmacyRequest_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
