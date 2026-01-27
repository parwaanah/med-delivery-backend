-- User delivery addresses (customer)

CREATE TABLE IF NOT EXISTS "UserAddress" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "label" TEXT NOT NULL DEFAULT 'Home',
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT NOT NULL DEFAULT '',
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT '',
  "pin" TEXT NOT NULL,
  "landmark" TEXT NOT NULL DEFAULT '',
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserAddress_userId_createdAt_idx" ON "UserAddress" ("userId", "createdAt");

-- Only one default address per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'UserAddress_one_default_per_user_idx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "UserAddress_one_default_per_user_idx" ON "UserAddress" ("userId") WHERE "isDefault" = true';
  END IF;
END
$$;

