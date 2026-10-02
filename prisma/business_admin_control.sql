-- Business admin control center (ניהול ובקרה) — additive, idempotent.
-- Run BEFORE deploying the matching code:
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/business_admin_control.sql

ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "businessId"  TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "entityType"  TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "entityId"    TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "entityLabel" TEXT;

CREATE INDEX IF NOT EXISTS "ActivityLog_businessId_createdAt_idx"
  ON "ActivityLog" ("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_businessId_action_createdAt_idx"
  ON "ActivityLog" ("businessId", "action", "createdAt");

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "securityAlertPrefs" JSONB;
