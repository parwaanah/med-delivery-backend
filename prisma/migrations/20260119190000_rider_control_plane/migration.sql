-- Add rider control plane columns
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "riderAvailability" TEXT NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN IF NOT EXISTS "riderReasonCode" TEXT,
ADD COLUMN IF NOT EXISTS "riderReasonNote" TEXT;

