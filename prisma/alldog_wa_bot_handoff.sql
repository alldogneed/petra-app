-- AllDog WhatsApp bot — handoff mode (alerts after handoff, "קיבלנו" reply, auto-resume, rep replies).
-- Additive and idempotent. Apply to production BEFORE deploying:
--   npx prisma db execute --url "$DIRECT_URL" --file prisma/alldog_wa_bot_handoff.sql
ALTER TABLE "WaBotConversation" ADD COLUMN IF NOT EXISTS "handoffNotifiedAt" TIMESTAMP(3);
ALTER TABLE "WaBotConversation" ADD COLUMN IF NOT EXISTS "handoffAckAt" TIMESTAMP(3);
ALTER TABLE "WaBotConversation" ADD COLUMN IF NOT EXISTS "lastHumanAt" TIMESTAMP(3);
ALTER TABLE "WaBotConversation" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "WaBotConversation_businessId_leadId_idx" ON "WaBotConversation"("businessId", "leadId");
