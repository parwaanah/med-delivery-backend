-- Add per-user notification preferences for push targeting

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
  "promotions" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Foreign key (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationPreference_userId_fkey') THEN
    ALTER TABLE "NotificationPreference"
      ADD CONSTRAINT "NotificationPreference_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE INDEX IF NOT EXISTS "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- Keep updatedAt current
CREATE OR REPLACE FUNCTION set_updated_at_notification_preference() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_notification_preference_updated_at ON "NotificationPreference";
CREATE TRIGGER tr_notification_preference_updated_at
BEFORE UPDATE ON "NotificationPreference"
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_notification_preference();

