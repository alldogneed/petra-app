-- Online Classes 004: course access security.
-- Device binding on portal sessions + per-business device cap and IP allowlist.
ALTER TABLE "PortalSession" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "PortalSession" ADD COLUMN IF NOT EXISTS "deviceLabel" TEXT;
ALTER TABLE "PortalSession" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
CREATE INDEX IF NOT EXISTS "PortalSession_portalUserId_deviceId_idx" ON "PortalSession"("portalUserId", "deviceId");

ALTER TABLE "BrandingSettings" ADD COLUMN IF NOT EXISTS "maxDevicesPerStudent" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "BrandingSettings" ADD COLUMN IF NOT EXISTS "ipRestrictionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BrandingSettings" ADD COLUMN IF NOT EXISTS "allowedIps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
