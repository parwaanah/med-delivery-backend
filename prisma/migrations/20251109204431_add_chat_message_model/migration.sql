/*
  Warnings:

  - You are about to drop the column `fromId` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `meta` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `toId` on the `ChatMessage` table. All the data in the column will be lost.
  - Added the required column `receiverId` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderId` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_fromId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_toId_fkey";

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "fromId",
DROP COLUMN "meta",
DROP COLUMN "toId",
ADD COLUMN     "receiverId" INTEGER NOT NULL,
ADD COLUMN     "senderId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
