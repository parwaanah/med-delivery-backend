-- AdminPermission: scoped permission tiers for ADMIN users

CREATE TABLE IF NOT EXISTS "AdminPermission" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminPermission_userId_code_key" ON "AdminPermission"("userId", "code");
CREATE INDEX IF NOT EXISTS "AdminPermission_userId_idx" ON "AdminPermission"("userId");
CREATE INDEX IF NOT EXISTS "AdminPermission_code_idx" ON "AdminPermission"("code");

