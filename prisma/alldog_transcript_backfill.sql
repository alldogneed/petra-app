-- AllDog item 36 — one-time transcription of past PayCall recordings (additive, idempotent).
-- Run with Or's approval BEFORE deploying: prisma db execute --url $DIRECT_URL --file prisma/alldog_transcript_backfill.sql
-- Stays until Or says to drop it: DROP TABLE "AllDogCallTranscriptBackfill";
CREATE TABLE IF NOT EXISTS "AllDogCallTranscriptBackfill" (
  "callId"      TEXT PRIMARY KEY,
  "callDate"    DATE NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "transcript"  TEXT,
  "durationSec" INTEGER,
  "error"       TEXT,
  "claimedAt"   TIMESTAMP(3),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AllDogCallTranscriptBackfill_status_idx" ON "AllDogCallTranscriptBackfill"("status");
-- RLS on, no policies — same as every other table (only the server role reads it).
ALTER TABLE "AllDogCallTranscriptBackfill" ENABLE ROW LEVEL SECURITY;
