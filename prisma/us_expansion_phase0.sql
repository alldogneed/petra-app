-- US expansion Phase 0 (docs/us-expansion/PHASE-0-foundation.md §0.2) — additive, idempotent.
-- Run in prod ONLY by Or: prisma db execute --url $DIRECT_URL --file prisma/us_expansion_phase0.sql
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'he-IL',
  ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'IL',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS "messagingChannel" TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS "billingProvider" TEXT NOT NULL DEFAULT 'cardcom';
