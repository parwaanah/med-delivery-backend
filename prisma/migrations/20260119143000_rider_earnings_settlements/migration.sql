-- Rider settlement batches
CREATE TABLE IF NOT EXISTS "RiderSettlementBatch" (
  "id" SERIAL PRIMARY KEY,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "RiderSettlementBatch_periodStart_periodEnd_key"
  ON "RiderSettlementBatch" ("periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "RiderSettlementBatch_createdAt_idx"
  ON "RiderSettlementBatch" ("createdAt");

-- Rider earnings ledger (per order)
CREATE TABLE IF NOT EXISTS "RiderEarning" (
  "id" SERIAL PRIMARY KEY,
  "riderId" INTEGER NOT NULL,
  "orderId" INTEGER NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'EARNING',
  "distanceKm" DOUBLE PRECISION,
  "baseFare" DECIMAL(12,2) NOT NULL,
  "distanceFare" DECIMAL(12,2) NOT NULL,
  "surgeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "surgeBonus" DECIMAL(12,2) NOT NULL,
  "bonus" DECIMAL(12,2) NOT NULL,
  "penalty" DECIMAL(12,2) NOT NULL,
  "netAmount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "settledAt" TIMESTAMP(3),
  "batchId" INTEGER,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "RiderEarning_orderId_key"
  ON "RiderEarning" ("orderId");

CREATE INDEX IF NOT EXISTS "RiderEarning_riderId_createdAt_idx"
  ON "RiderEarning" ("riderId", "createdAt");

CREATE INDEX IF NOT EXISTS "RiderEarning_status_createdAt_idx"
  ON "RiderEarning" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "RiderEarning_batchId_idx"
  ON "RiderEarning" ("batchId");

ALTER TABLE "RiderEarning"
  ADD CONSTRAINT "RiderEarning_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiderEarning"
  ADD CONSTRAINT "RiderEarning_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiderEarning"
  ADD CONSTRAINT "RiderEarning_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "RiderSettlementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

