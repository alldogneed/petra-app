-- Item 40.4 (Or, 28/10): the phone customers see in automatic messages, per business.
-- Additive + idempotent. Empty = Business.phone as before (no behaviour change for other businesses).
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "customerContactPhone" TEXT;
