-- Manual migration: MCP OAuth 2.1 (auto-login for Claude / Codex connectors).
-- Apply to production (Supabase SQL editor / psql, or
--   npx prisma db execute --file prisma/mcp_oauth.sql --url "$DIRECT_URL")
-- BEFORE deploying the code that reads these columns/tables. vercel-build does NOT run migrations.
-- Idempotent — safe to re-run. Additive only: existing McpConnection rows (manual tokens)
-- get NULL in all new columns and keep working unchanged.
-- Equivalent to `prisma migrate diff` output for this schema change.

-- AlterTable
ALTER TABLE "McpConnection" ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3);
ALTER TABLE "McpConnection" ADD COLUMN IF NOT EXISTS "oauthClientId" TEXT;
ALTER TABLE "McpConnection" ADD COLUMN IF NOT EXISTS "prevRefreshTokenHash" TEXT;
ALTER TABLE "McpConnection" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;
ALTER TABLE "McpConnection" ADD COLUMN IF NOT EXISTS "refreshRotatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OAuthAuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scopes" TEXT[],
    "profile" TEXT NOT NULL,
    "role" TEXT,
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "connectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthCode_pkey" PRIMARY KEY ("id")
);

-- AlterTable (security-review follow-up: code-replay revocation; for DBs where the table already exists)
ALTER TABLE "OAuthAuthCode" ADD COLUMN IF NOT EXISTS "connectionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAuthCode_codeHash_key" ON "OAuthAuthCode"("codeHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OAuthAuthCode_expiresAt_idx" ON "OAuthAuthCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "McpConnection_refreshTokenHash_key" ON "McpConnection"("refreshTokenHash");

-- AddForeignKey (Postgres has no ADD CONSTRAINT IF NOT EXISTS → guard via pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OAuthAuthCode_clientId_fkey'
  ) THEN
    ALTER TABLE "OAuthAuthCode" ADD CONSTRAINT "OAuthAuthCode_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Supabase: block PostgREST anon/authenticated access (Prisma bypasses RLS) — see prisma/enable_rls.sql.
ALTER TABLE "OAuthClient"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthAuthCode" ENABLE ROW LEVEL SECURITY;
