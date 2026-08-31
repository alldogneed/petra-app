-- Online Classes 003: lesson descriptions + real watch-progress tracking.
-- Lesson.description  — shown under the player in the portal.
-- LessonProgress      — completedAt becomes nullable (a row can now mean "in progress"),
--                       plus percent / watchedSeconds / updatedAt.
-- Existing rows are all completions, so backfill completedAt-bearing rows to 100%.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "LessonProgress" ALTER COLUMN "completedAt" DROP NOT NULL;
ALTER TABLE "LessonProgress" ALTER COLUMN "completedAt" DROP DEFAULT;
ALTER TABLE "LessonProgress" ADD COLUMN IF NOT EXISTS "percent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LessonProgress" ADD COLUMN IF NOT EXISTS "watchedSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LessonProgress" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LessonProgress" SET "percent" = 100 WHERE "completedAt" IS NOT NULL AND "percent" = 0;
