-- Add minimal payment tracking to Order.
ALTER TABLE "Order"
ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "paymentRequestedAt" TIMESTAMP(3),
ADD COLUMN "paidAt" TIMESTAMP(3);

