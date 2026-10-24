-- AllDog item 33 — rep coaching from answered PayCall calls (additive, idempotent).
-- Run BEFORE deploying: prisma db execute --url $DIRECT_URL --file prisma/alldog_call_coaching.sql
ALTER TABLE "PaycallCallRetry" ADD COLUMN IF NOT EXISTS "coaching" JSONB;
ALTER TABLE "PaycallCallRetry" ADD COLUMN IF NOT EXISTS "coachedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "PaycallCallRetry_businessId_coachedAt_idx" ON "PaycallCallRetry"("businessId", "coachedAt");
