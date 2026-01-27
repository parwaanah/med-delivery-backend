-- Add missing tables required by Admin approvals + partner onboarding flows

-- PartnerProfile
CREATE TABLE "PartnerProfile" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "role" "UserRole" NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");
CREATE INDEX "PartnerProfile_userId_idx" ON "PartnerProfile"("userId");

ALTER TABLE "PartnerProfile"
ADD CONSTRAINT "PartnerProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VerificationDocument
CREATE TABLE "VerificationDocument" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "VerificationDocument_userId_idx" ON "VerificationDocument"("userId");

ALTER TABLE "VerificationDocument"
ADD CONSTRAINT "VerificationDocument_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
