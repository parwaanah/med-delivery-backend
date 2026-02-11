-- Analytics events sink (Phase 8)
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "userId" INTEGER,
  "sessionId" TEXT,
  "props" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AnalyticsEvent_userId_fkey') THEN
    ALTER TABLE "AnalyticsEvent"
      ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent" ("createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent" ("name", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent" ("userId", "createdAt");

