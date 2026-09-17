-- Manual migration: Lead deal value ("ערך עסקה").
-- Apply to production (Supabase SQL editor / psql, or
--   npx prisma db execute --file prisma/lead_deal_value.sql --url "$DIRECT_URL")
-- BEFORE deploying the code that reads Lead.dealValue. vercel-build does NOT run migrations.
-- Idempotent — safe to re-run. Additive only; existing leads get NULL (= not entered).

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "dealValue" DOUBLE PRECISION;
