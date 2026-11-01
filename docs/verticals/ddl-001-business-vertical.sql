-- Verticals phase 1 — Business.vertical ("dogs" | "generic").
-- Additive + idempotent. Every existing row gets "dogs" = today's behaviour.
-- Run BEFORE deploying:  npx prisma db execute --url "$DIRECT_URL" --file docs/verticals/ddl-001-business-vertical.sql
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "vertical" TEXT NOT NULL DEFAULT 'dogs';
