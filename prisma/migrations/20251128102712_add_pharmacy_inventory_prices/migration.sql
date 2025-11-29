/*
  Warnings:

  - You are about to drop the column `price` on the `PharmacyInventory` table. All the data in the column will be lost.
  - Added the required column `mrp` to the `PharmacyInventory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellingPrice` to the `PharmacyInventory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PharmacyInventory" DROP COLUMN "price",
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mrp" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "sellingPrice" DECIMAL(12,2) NOT NULL;
