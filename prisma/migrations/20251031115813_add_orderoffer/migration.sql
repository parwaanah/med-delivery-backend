-- CreateTable
CREATE TABLE "OrderOffer" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "pharmacyId" INTEGER,
    "riderId" INTEGER,
    "offeredTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderOffer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
