-- Mobile backend features (FCM tokens, consent, coupons, prescription status, tracking coords)

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MobilePlatform') THEN
    CREATE TYPE "MobilePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrescriptionStatus') THEN
    CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponType') THEN
    CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FLAT');
  END IF;
END$$;

-- Prescription fields
ALTER TABLE "Prescription"
  ADD COLUMN IF NOT EXISTS "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- Backfill status for existing rows (idempotent)
-- Note: explicit enum casts are required here to avoid Postgres inferring TEXT in some contexts.
UPDATE "Prescription"
SET
  "status" = (CASE WHEN "verified" = true THEN 'APPROVED' ELSE 'PENDING' END)::"PrescriptionStatus",
  "verifiedAt" = CASE WHEN "verified" = true AND "verifiedAt" IS NULL THEN "createdAt" ELSE "verifiedAt" END
WHERE "status" = 'PENDING'::"PrescriptionStatus"
   OR "status" = 'APPROVED'::"PrescriptionStatus";

CREATE INDEX IF NOT EXISTS "Prescription_customerId_createdAt_idx" ON "Prescription" ("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Prescription_status_idx" ON "Prescription" ("status");

-- Order delivery coordinates (optional)
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveryLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "deliveryLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
  ADD COLUMN IF NOT EXISTS "couponDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Cart coupon fields (optional)
ALTER TABLE "Cart"
  ADD COLUMN IF NOT EXISTS "couponCode" TEXT,
  ADD COLUMN IF NOT EXISTS "couponDiscount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "couponAppliedAt" TIMESTAMP(3);

-- Device tokens
CREATE TABLE IF NOT EXISTS "DeviceToken" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "platform" "MobilePlatform" NOT NULL,
  "deviceId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeviceToken_userId_fkey') THEN
    ALTER TABLE "DeviceToken"
      ADD CONSTRAINT "DeviceToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX IF NOT EXISTS "DeviceToken_userId_enabled_idx" ON "DeviceToken"("userId", "enabled");
CREATE INDEX IF NOT EXISTS "DeviceToken_platform_idx" ON "DeviceToken"("platform");

-- Terms acceptance
CREATE TABLE IF NOT EXISTS "TermsAcceptance" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "userAgent" TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TermsAcceptance_userId_fkey') THEN
    ALTER TABLE "TermsAcceptance"
      ADD CONSTRAINT "TermsAcceptance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");
CREATE INDEX IF NOT EXISTS "TermsAcceptance_userId_acceptedAt_idx" ON "TermsAcceptance"("userId", "acceptedAt");

-- Coupons + redemptions
CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "type" "CouponType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "minOrder" DECIMAL(12,2),
  "maxDiscount" DECIMAL(12,2),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "perUserLimit" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id" SERIAL PRIMARY KEY,
  "couponId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "orderId" INTEGER,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CouponRedemption_couponId_fkey') THEN
    ALTER TABLE "CouponRedemption"
      ADD CONSTRAINT "CouponRedemption_couponId_fkey"
      FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CouponRedemption_userId_fkey') THEN
    ALTER TABLE "CouponRedemption"
      ADD CONSTRAINT "CouponRedemption_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CouponRedemption_orderId_fkey') THEN
    ALTER TABLE "CouponRedemption"
      ADD CONSTRAINT "CouponRedemption_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_usedAt_idx" ON "CouponRedemption"("couponId", "usedAt");
CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_usedAt_idx" ON "CouponRedemption"("userId", "usedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_couponId_userId_orderId_key" ON "CouponRedemption"("couponId","userId","orderId");
