-- Petra AI (in-app support assistant) — conversations + messages.
-- Additive and idempotent. Apply to production with:
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/assistant.sql
-- (never `prisma db push` against production).

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssistantConversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "screen" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalatedAt" TIMESTAMP(3),
    "supportTicketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "screen" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AssistantConversation_businessId_createdAt_idx" ON "AssistantConversation"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantConversation_userId_createdAt_idx" ON "AssistantConversation"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantMessage_conversationId_createdAt_idx" ON "AssistantMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantMessage_businessId_createdAt_idx" ON "AssistantMessage"("businessId", "createdAt");

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS → guard via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssistantConversation_businessId_fkey') THEN
    ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssistantConversation_userId_fkey') THEN
    ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AssistantMessage_conversationId_fkey') THEN
    ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Supabase: block PostgREST anon/authenticated access. No policies on purpose — Prisma
-- connects with a role that bypasses RLS, and tenant isolation is enforced in the API
-- (every query filters by the session's businessId + userId). See prisma/enable_rls.sql.
ALTER TABLE "AssistantConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssistantMessage"      ENABLE ROW LEVEL SECURITY;
