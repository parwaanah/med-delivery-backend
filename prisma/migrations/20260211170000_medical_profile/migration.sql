-- Add MedicalProfile for customer allergies/conditions

CREATE TABLE "MedicalProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "allergies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicalProfile_userId_key" ON "MedicalProfile"("userId");

CREATE INDEX "MedicalProfile_userId_idx" ON "MedicalProfile"("userId");

ALTER TABLE "MedicalProfile" ADD CONSTRAINT "MedicalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
