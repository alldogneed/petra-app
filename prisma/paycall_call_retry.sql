-- Queue of answered PayCall calls whose recording was not ready yet (src/lib/alldog/call-retry.ts).
-- Additive and idempotent. Apply to production BEFORE turning ALLDOG_CALL_SUMMARIES_ENABLED on:
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/paycall_call_retry.sql
-- (never `prisma db push` against production).

CREATE TABLE IF NOT EXISTS "PaycallCallRetry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaycallCallRetry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaycallCallRetry_callId_key" ON "PaycallCallRetry"("callId");
CREATE INDEX IF NOT EXISTS "PaycallCallRetry_status_nextAttemptAt_idx" ON "PaycallCallRetry"("status", "nextAttemptAt");

-- RLS on, no policies — same as every other table (only the server role reads it).
ALTER TABLE "PaycallCallRetry" ENABLE ROW LEVEL SECURITY;
