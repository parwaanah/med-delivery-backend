-- Order delivery snapshot fields (immutable audit/history)

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveryAddressText" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryName" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryLine2" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "deliveryCity" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryState" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "deliveryPin" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryLandmark" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "deliveryNotes" TEXT NOT NULL DEFAULT '';

