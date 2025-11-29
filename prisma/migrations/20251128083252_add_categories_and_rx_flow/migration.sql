/*
  Warnings:

  - The values [PENDING_PAYMENT,PENDING_CONFIRMATION] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `transactionId` on the `PaymentAttempt` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MedicineCategory" AS ENUM ('NON_RX', 'CHRONIC', 'STRICT_RX');

-- CreateEnum
CREATE TYPE "PrescriptionType" AS ENUM ('NONE', 'SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('PAY_FIRST', 'PAY_AFTER_ACCEPT', 'PAY_AFTER_VERIFICATION');

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'REACHED_PHARMACY', 'PICKED_UP', 'DELIVERED', 'CANCELED', 'PAID');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "PaymentAttempt" DROP CONSTRAINT "PaymentAttempt_transactionId_fkey";

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "category" "MedicineCategory" NOT NULL DEFAULT 'NON_RX',
ADD COLUMN     "rxType" "PrescriptionType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMode" "PaymentMode" NOT NULL DEFAULT 'PAY_AFTER_ACCEPT',
ADD COLUMN     "prescriptionId" INTEGER,
ADD COLUMN     "requiresPrescription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PaymentAttempt" DROP COLUMN "transactionId",
ADD COLUMN     "providerOrder" TEXT;

-- CreateTable
CREATE TABLE "Prescription" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTimeline" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_idx" ON "OrderTimeline"("orderId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimeline" ADD CONSTRAINT "OrderTimeline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
