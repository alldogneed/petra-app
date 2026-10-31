-- Verticals phase 1 — a training program of a "generic" business has no subject (dog).
-- Relaxes NOT NULL only: existing rows keep their dogId, the FK and the index stay.
-- Idempotent (DROP NOT NULL on a nullable column is a no-op).
-- Run BEFORE deploying:  npx prisma db execute --url "$DIRECT_URL" --file docs/verticals/ddl-002-training-program-dog-optional.sql
ALTER TABLE "TrainingProgram" ALTER COLUMN "dogId" DROP NOT NULL;
