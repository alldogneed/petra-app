-- US expansion Phase 0 (docs/us-expansion/PHASE-0-foundation.md §0.2) — additive, idempotent.
-- Applied to prod 01.11.2026 (Or asked; Supabase migration "us_expansion_phase0"). Re-running is a no-op.
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'he-IL',
  ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'IL',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS "messagingChannel" TEXT NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS "billingProvider" TEXT NOT NULL DEFAULT 'cardcom';
