-- Support tickets: replies, handling history, SLA monitoring (additive, idempotent).
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastCustomerMessageAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "lastStaffReplyAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "customerUnread" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "slaAlertedAt" TIMESTAMP(3);

-- Existing tickets: the customer's message is the ticket itself.
UPDATE "SupportTicket" SET "lastCustomerMessageAt" = "createdAt" WHERE "lastCustomerMessageAt" IS NULL;
UPDATE "SupportTicket" SET "resolvedAt" = "updatedAt" WHERE status = 'resolved' AND "resolvedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "SupportTicketEvent" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "authorType" TEXT NOT NULL,
  "authorUserId" TEXT,
  "authorName" TEXT,
  "body" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportTicketEvent_ticketId_createdAt_idx" ON "SupportTicketEvent"("ticketId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "SupportTicketEvent" ADD CONSTRAINT "SupportTicketEvent_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "SupportTicketEvent" ENABLE ROW LEVEL SECURITY;
