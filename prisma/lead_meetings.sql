-- Manual migration: meetings booked with a lead before it is a customer.
-- Apply to production BEFORE deploying the code that reads LeadMeeting
-- (Supabase SQL editor, or Supabase MCP apply_migration with Or's go-ahead).
-- Idempotent — safe to re-run. Additive only.

CREATE TABLE IF NOT EXISTS "LeadMeeting" (
    "id"              TEXT NOT NULL,
    "businessId"      TEXT NOT NULL,
    "leadId"          TEXT NOT NULL,
    "date"            TIMESTAMP(3) NOT NULL,
    "startTime"       TEXT NOT NULL,
    "endTime"         TEXT NOT NULL,
    "serviceId"       TEXT,
    "location"        TEXT,
    "notes"           TEXT,
    "status"          TEXT NOT NULL DEFAULT 'scheduled',
    "outcomeAt"       TIMESTAMP(3),
    "appointmentId"   TEXT,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadMeeting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadMeeting_businessId_date_idx" ON "LeadMeeting"("businessId", "date");
CREATE INDEX IF NOT EXISTS "LeadMeeting_leadId_idx" ON "LeadMeeting"("leadId");

DO $$ BEGIN
  ALTER TABLE "LeadMeeting"
    ADD CONSTRAINT "LeadMeeting_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadMeeting"
    ADD CONSTRAINT "LeadMeeting_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadMeeting"
    ADD CONSTRAINT "LeadMeeting_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
