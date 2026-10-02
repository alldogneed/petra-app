-- Per-member dashboard customization (show/hide + order of widgets).
-- Additive and idempotent; old code ignores the column.
ALTER TABLE "BusinessUser" ADD COLUMN IF NOT EXISTS "dashboardPrefs" JSONB;
