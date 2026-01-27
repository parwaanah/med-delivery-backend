ALTER TABLE "OrderOffer"
ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;

CREATE INDEX IF NOT EXISTS "OrderOffer_orderId_status_idx" ON "OrderOffer"("orderId", "status");
CREATE INDEX IF NOT EXISTS "OrderOffer_expiresAt_idx" ON "OrderOffer"("expiresAt");

