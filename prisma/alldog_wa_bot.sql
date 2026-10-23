-- AllDog WhatsApp bot — conversations + messages (src/lib/alldog-bot).
-- Additive and idempotent. Apply to production with:
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/alldog_wa_bot.sql
-- (never `prisma db push` against production).

CREATE TABLE IF NOT EXISTS "WaBotConversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "leadId" TEXT,
    "profileName" TEXT,
    "attributionSource" TEXT,
    "attributionPage" TEXT,
    "summaryCallLogId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastBotReplyAt" TIMESTAMP(3),
    "handoffAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaBotConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WaBotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "text" TEXT NOT NULL,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaBotMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WaBotConversation_businessId_phone_key" ON "WaBotConversation"("businessId", "phone");
CREATE INDEX IF NOT EXISTS "WaBotConversation_businessId_lastInboundAt_idx" ON "WaBotConversation"("businessId", "lastInboundAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WaBotMessage_waMessageId_key" ON "WaBotMessage"("waMessageId");
CREATE INDEX IF NOT EXISTS "WaBotMessage_conversationId_createdAt_idx" ON "WaBotMessage"("conversationId", "createdAt");

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS → guard via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaBotMessage_conversationId_fkey') THEN
    ALTER TABLE "WaBotMessage" ADD CONSTRAINT "WaBotMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "WaBotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS on, no policies — same as every other table (only the server role reads these).
ALTER TABLE "WaBotConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaBotMessage" ENABLE ROW LEVEL SECURITY;
