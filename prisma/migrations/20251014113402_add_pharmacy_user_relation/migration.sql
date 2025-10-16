/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Pharmacy` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_userId_key" ON "Pharmacy"("userId");

-- AddForeignKey
ALTER TABLE "Pharmacy" ADD CONSTRAINT "Pharmacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
