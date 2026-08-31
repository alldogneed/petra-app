-- Online Classes 005: certificates, lesson Q&A, module quizzes, announcement markers.
ALTER TABLE "Membership"  ADD COLUMN IF NOT EXISTS "lastNudgeAt" TIMESTAMP(3);
ALTER TABLE "OnlineClass" ADD COLUMN IF NOT EXISTS "recordingRef" TEXT;
ALTER TABLE "Lesson"      ADD COLUMN IF NOT EXISTS "announcedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CourseCertificate" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "serial" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "courseTitle" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseCertificate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CourseCertificate_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourseCertificate_serial_key" ON "CourseCertificate"("serial");
CREATE UNIQUE INDEX IF NOT EXISTS "CourseCertificate_membershipId_courseId_key" ON "CourseCertificate"("membershipId", "courseId");
CREATE INDEX IF NOT EXISTS "CourseCertificate_businessId_issuedAt_idx" ON "CourseCertificate"("businessId", "issuedAt");

CREATE TABLE IF NOT EXISTS "LessonQuestion" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  "answerBody" TEXT,
  "answeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LessonQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonQuestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LessonQuestion_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LessonQuestion_lessonId_createdAt_idx" ON "LessonQuestion"("lessonId", "createdAt");
CREATE INDEX IF NOT EXISTS "LessonQuestion_businessId_answeredAt_idx" ON "LessonQuestion"("businessId", "answeredAt");

CREATE TABLE IF NOT EXISTS "Quiz" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "passScore" INTEGER NOT NULL DEFAULT 70,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Quiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Quiz_moduleId_key" ON "Quiz"("moduleId");
CREATE INDEX IF NOT EXISTS "Quiz_businessId_idx" ON "Quiz"("businessId");

CREATE TABLE IF NOT EXISTS "QuizQuestion" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuizQuestion_quizId_position_idx" ON "QuizQuestion"("quizId", "position");

CREATE TABLE IF NOT EXISTS "QuizOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuizOption_questionId_position_idx" ON "QuizOption"("questionId", "position");

CREATE TABLE IF NOT EXISTS "QuizAttempt" (
  "id" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuizAttempt_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuizAttempt_membershipId_quizId_idx" ON "QuizAttempt"("membershipId", "quizId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_quizId_createdAt_idx" ON "QuizAttempt"("quizId", "createdAt");
