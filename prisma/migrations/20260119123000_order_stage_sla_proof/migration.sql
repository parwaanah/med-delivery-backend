-- Add rider stage timestamps + delivery proof fields
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "riderAssignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reachedPharmacyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "outForDeliveryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveryProofUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "deliverySignatureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryOtp" TEXT;

-- Helpful indexes for SLA scans
CREATE INDEX IF NOT EXISTS "Order_status_riderAssignedAt_idx"
  ON "Order" ("status", "riderAssignedAt");

CREATE INDEX IF NOT EXISTS "Order_status_reachedPharmacyAt_idx"
  ON "Order" ("status", "reachedPharmacyAt");

CREATE INDEX IF NOT EXISTS "Order_status_pickedUpAt_idx"
  ON "Order" ("status", "pickedUpAt");

CREATE INDEX IF NOT EXISTS "Order_status_outForDeliveryAt_idx"
  ON "Order" ("status", "outForDeliveryAt");

