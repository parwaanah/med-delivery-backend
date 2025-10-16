/*
  Warnings:

  - You are about to drop the column `vehicleNo` on the `Rider` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `Rider` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `vehicleNumber` to the `Rider` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Rider" DROP COLUMN "vehicleNo",
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vehicleNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Rider_phone_key" ON "Rider"("phone");
