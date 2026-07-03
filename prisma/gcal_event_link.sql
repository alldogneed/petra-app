-- Manual migration: per-user Google Calendar event links.
-- Apply to production (Supabase SQL editor / psql) BEFORE deploying the code
-- that reads GcalEventLink. vercel-build does NOT run migrations.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "GcalEventLink" (
    "id"         TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "eventId"    TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GcalEventLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GcalEventLink_entityType_entityId_userId_key"
    ON "GcalEventLink"("entityType", "entityId", "userId");

CREATE INDEX IF NOT EXISTS "GcalEventLink_userId_idx"
    ON "GcalEventLink"("userId");

-- Supabase exposes public tables via PostgREST — block anon access.
-- Prisma uses the service_role key which bypasses RLS.
ALTER TABLE "public"."GcalEventLink" ENABLE ROW LEVEL SECURITY;
