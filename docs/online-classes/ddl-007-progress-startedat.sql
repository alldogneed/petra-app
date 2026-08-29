-- Online Classes 007: LessonProgress.startedAt.
-- A single fabricated progress report could complete any lesson shorter than the
-- first-report grace window. Completion now also requires that enough real time
-- has passed since the FIRST report on that lesson — watching takes time.
ALTER TABLE "LessonProgress" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
-- Existing rows: treat their last update as the start so nothing regresses.
UPDATE "LessonProgress" SET "startedAt" = "updatedAt" WHERE "startedAt" IS NULL;
