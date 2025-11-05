/*
  Warnings:

  - Made the column `status` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvedBy" INTEGER,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
