-- Online Classes module — additive DDL (new tables only, no changes to existing tables).
-- Apply: PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma db execute --file docs/online-classes/ddl.sql --schema prisma/schema.prisma
-- Mirrors prisma/schema.prisma "Online Classes module" section exactly. Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "BrandingSettings" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#F97316',
  "secondaryColor" TEXT,
  "senderName" TEXT,
  "paymentLinkUrl" TEXT,
  "aboutText" TEXT,
  "customDomain" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrandingSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BrandingSettings_businessId_key" ON "BrandingSettings"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "BrandingSettings_customDomain_key" ON "BrandingSettings"("customDomain");

CREATE TABLE IF NOT EXISTS "PortalUser" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortalUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalUser_phone_key" ON "PortalUser"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "PortalUser_email_key" ON "PortalUser"("email");
CREATE INDEX IF NOT EXISTS "PortalUser_email_idx" ON "PortalUser"("email");

CREATE TABLE IF NOT EXISTS "PortalOtp" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PortalOtp_email_createdAt_idx" ON "PortalOtp"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "PortalOtp_expiresAt_idx" ON "PortalOtp"("expiresAt");

CREATE TABLE IF NOT EXISTS "PortalSession" (
  "id" TEXT NOT NULL,
  "portalUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PortalSession_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "PortalSession_portalUserId_idx" ON "PortalSession"("portalUserId");
CREATE INDEX IF NOT EXISTS "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL,
  "portalUserId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "validUntil" TIMESTAMP(3),
  "paymentNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "expiryReminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Membership_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "PortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_portalUserId_businessId_key" ON "Membership"("portalUserId", "businessId");
CREATE INDEX IF NOT EXISTS "Membership_businessId_status_idx" ON "Membership"("businessId", "status");

CREATE TABLE IF NOT EXISTS "OnlineClass" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "instructorName" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationMin" INTEGER NOT NULL DEFAULT 60,
  "capacity" INTEGER NOT NULL,
  "spotsTaken" INTEGER NOT NULL DEFAULT 0,
  "zoomLink" TEXT,
  "zoomLinkSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlineClass_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnlineClass_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OnlineClass_businessId_startsAt_idx" ON "OnlineClass"("businessId", "startsAt");

CREATE TABLE IF NOT EXISTS "ClassRegistration" (
  "id" TEXT NOT NULL,
  "onlineClassId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'registered',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassRegistration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassRegistration_onlineClassId_fkey" FOREIGN KEY ("onlineClassId") REFERENCES "OnlineClass"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassRegistration_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassRegistration_onlineClassId_membershipId_key" ON "ClassRegistration"("onlineClassId", "membershipId");
CREATE INDEX IF NOT EXISTS "ClassRegistration_membershipId_idx" ON "ClassRegistration"("membershipId");

CREATE TABLE IF NOT EXISTS "Course" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "coverUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Course_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Course_businessId_status_idx" ON "Course"("businessId", "status");

CREATE TABLE IF NOT EXISTS "CourseModule" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CourseModule_courseId_position_idx" ON "CourseModule"("courseId", "position");

CREATE TABLE IF NOT EXISTS "Lesson" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'video',
  "provider" TEXT NOT NULL DEFAULT 'youtube',
  "videoRef" TEXT,
  "fileUrl" TEXT,
  "textContent" TEXT,
  "durationMin" INTEGER,
  "isFreePreview" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Lesson_moduleId_position_idx" ON "Lesson"("moduleId", "position");

CREATE TABLE IF NOT EXISTS "LessonProgress" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonProgress_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LessonProgress_membershipId_lessonId_key" ON "LessonProgress"("membershipId", "lessonId");
