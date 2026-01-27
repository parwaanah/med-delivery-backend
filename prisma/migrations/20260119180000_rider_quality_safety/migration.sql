-- Rider quality & safety system

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "riderAvgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "riderRatingCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "RiderRating" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL UNIQUE,
  "riderId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiderRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RiderRating_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RiderRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RiderRating_riderId_idx" ON "RiderRating"("riderId");
CREATE INDEX IF NOT EXISTS "RiderRating_customerId_idx" ON "RiderRating"("customerId");

CREATE TABLE IF NOT EXISTS "RiderStrike" (
  "id" SERIAL PRIMARY KEY,
  "riderId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiderStrike_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RiderStrike_riderId_idx" ON "RiderStrike"("riderId");
CREATE INDEX IF NOT EXISTS "RiderStrike_createdAt_idx" ON "RiderStrike"("createdAt");

CREATE TABLE IF NOT EXISTS "RiderFraudSignal" (
  "id" SERIAL PRIMARY KEY,
  "riderId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "severity" INTEGER NOT NULL DEFAULT 50,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiderFraudSignal_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RiderFraudSignal_riderId_idx" ON "RiderFraudSignal"("riderId");
CREATE INDEX IF NOT EXISTS "RiderFraudSignal_createdAt_idx" ON "RiderFraudSignal"("createdAt");

