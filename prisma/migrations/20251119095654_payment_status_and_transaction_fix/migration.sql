/*
  Warnings:

  - The `orderId` column on the `Transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "orderId",
ADD COLUMN     "orderId" INTEGER;

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");
