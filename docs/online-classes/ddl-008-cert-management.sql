-- Online Classes 008: certificate management (manual issue, revocation) + custom design.
ALTER TABLE "CourseCertificate" ADD COLUMN IF NOT EXISTS "issuedManually" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CourseCertificate" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "CourseCertificate" ADD COLUMN IF NOT EXISTS "revokedReason" TEXT;
CREATE INDEX IF NOT EXISTS "CourseCertificate_businessId_revokedAt_idx" ON "CourseCertificate"("businessId", "revokedAt");

ALTER TABLE "BrandingSettings" ADD COLUMN IF NOT EXISTS "certificateSignatureUrl" TEXT;
ALTER TABLE "BrandingSettings" ADD COLUMN IF NOT EXISTS "certificateSignerName" TEXT;
ALTER TABLE "BrandingSettings" ADD COLUMN IF NOT EXISTS "certificateFooterText" TEXT;
