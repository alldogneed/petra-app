-- AllDog voice agent ("אלירן", ElevenLabs) — one row per phone call (VoiceAgentCall).
-- Additive and idempotent. Apply to production with:
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/voice_agent_call.sql
-- (never `prisma db push` against production).
-- Touches no existing table: the FKs live on VoiceAgentCall only.

CREATE TABLE IF NOT EXISTS "VoiceAgentCall" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT,
    "callerPhone" TEXT,
    "callerPhoneNorm" TEXT,
    "providerConversationId" TEXT NOT NULL,
    "externalCallId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "outcome" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "transcript" JSONB,
    "summary" TEXT,
    "salesBrief" JSONB,
    "leadMeetingId" TEXT,
    "summaryAttempts" INTEGER NOT NULL DEFAULT 0,
    "summaryNextAt" TIMESTAMP(3),
    "summaryLockedUntil" TIMESTAMP(3),
    "summaryError" TEXT,
    "summaryCallLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAgentCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceAgentCall_providerConversationId_key" ON "VoiceAgentCall"("providerConversationId");
CREATE INDEX IF NOT EXISTS "VoiceAgentCall_businessId_createdAt_idx" ON "VoiceAgentCall"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "VoiceAgentCall_leadId_idx" ON "VoiceAgentCall"("leadId");
CREATE INDEX IF NOT EXISTS "VoiceAgentCall_callerPhoneNorm_idx" ON "VoiceAgentCall"("callerPhoneNorm");

-- End-of-call summary queue (section 5). Also added to a table created by an earlier version of this file.
ALTER TABLE "VoiceAgentCall" ADD COLUMN IF NOT EXISTS "summaryAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VoiceAgentCall" ADD COLUMN IF NOT EXISTS "summaryNextAt" TIMESTAMP(3);
ALTER TABLE "VoiceAgentCall" ADD COLUMN IF NOT EXISTS "summaryLockedUntil" TIMESTAMP(3);
ALTER TABLE "VoiceAgentCall" ADD COLUMN IF NOT EXISTS "summaryError" TEXT;
ALTER TABLE "VoiceAgentCall" ADD COLUMN IF NOT EXISTS "summaryCallLogId" TEXT;
CREATE INDEX IF NOT EXISTS "VoiceAgentCall_summaryNextAt_idx" ON "VoiceAgentCall"("summaryNextAt");
CREATE INDEX IF NOT EXISTS "VoiceAgentCall_status_createdAt_idx" ON "VoiceAgentCall"("status", "createdAt");

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS → guard via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoiceAgentCall_leadId_fkey') THEN
    ALTER TABLE "VoiceAgentCall" ADD CONSTRAINT "VoiceAgentCall_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'VoiceAgentCall_leadMeetingId_fkey') THEN
    ALTER TABLE "VoiceAgentCall" ADD CONSTRAINT "VoiceAgentCall_leadMeetingId_fkey"
      FOREIGN KEY ("leadMeetingId") REFERENCES "LeadMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS on, no policies — same as Lead / CallLog (only the server role reads this table).
ALTER TABLE "VoiceAgentCall" ENABLE ROW LEVEL SECURITY;
