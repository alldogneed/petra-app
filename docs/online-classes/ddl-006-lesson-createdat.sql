-- Online Classes 006: Lesson.createdAt, so the engagement cron can tell a genuinely
-- new lesson from pre-existing catalog content instead of inferring it per course.
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill guard: every lesson that existed before this column was added is
-- pre-existing catalog, NOT news. Mark it announced so the engagement cron can
-- never retro-blast students about content they already have.
UPDATE "Lesson" SET "announcedAt" = CURRENT_TIMESTAMP WHERE "announcedAt" IS NULL;
