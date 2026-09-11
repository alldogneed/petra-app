-- Manual migration: Lead traffic attribution (source / medium / campaign / pages).
-- Apply to production (Supabase SQL editor / psql, or
--   npx prisma db execute --file prisma/lead_attribution.sql --url "$DIRECT_URL")
-- BEFORE deploying the code that reads Lead.trafficSource. vercel-build does NOT run migrations.
-- Idempotent — safe to re-run. Additive only; existing leads get trafficSource = 'unknown'.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "trafficSource" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "medium"        TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "campaign"      TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "landingPage"   TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "referrer"      TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "firstPage"     TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "gclid"         TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "pageType"      TEXT;

-- Backfill (no-op for fresh columns, but explicit in case the column pre-existed as nullable).
UPDATE "Lead" SET "trafficSource" = 'unknown' WHERE "trafficSource" IS NULL;

CREATE INDEX IF NOT EXISTS "Lead_businessId_trafficSource_createdAt_idx"
    ON "Lead"("businessId", "trafficSource", "createdAt");
