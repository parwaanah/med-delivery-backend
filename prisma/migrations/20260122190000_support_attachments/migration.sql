-- Support message attachments (array of URLs stored in JSON)

ALTER TABLE "SupportMessage"
  ADD COLUMN IF NOT EXISTS "attachments" JSONB;

