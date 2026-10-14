-- Manual migration: team invitations (invite link + invitee sets own password).
-- Apply to production (Supabase SQL editor / psql, or
--   npx prisma db execute --file prisma/team_invitations.sql --url "$DIRECT_URL")
-- BEFORE deploying the code that reads TeamInvitation. vercel-build does NOT run migrations.
-- Idempotent — safe to re-run. Additive only.

CREATE TABLE IF NOT EXISTS "TeamInvitation" (
    "id"          TEXT NOT NULL,
    "businessId"  TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "role"        TEXT NOT NULL DEFAULT 'user',
    "tokenHash"   TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "acceptedAt"  TIMESTAMP(3),
    "revokedAt"   TIMESTAMP(3),
    "lastSentAt"  TIMESTAMP(3),
    "emailError"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "TeamInvitation_businessId_idx" ON "TeamInvitation"("businessId");
CREATE INDEX IF NOT EXISTS "TeamInvitation_email_idx" ON "TeamInvitation"("email");

DO $$ BEGIN
  ALTER TABLE "TeamInvitation"
    ADD CONSTRAINT "TeamInvitation_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
