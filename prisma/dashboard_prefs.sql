-- Per-member dashboard customization (show/hide + order of widgets).
-- Additive and idempotent; old code ignores the column.
SET lock_timeout = '5s';
ALTER TABLE "BusinessUser" ADD COLUMN IF NOT EXISTS "dashboardPrefs" JSONB;
