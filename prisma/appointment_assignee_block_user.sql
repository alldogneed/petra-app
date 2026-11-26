-- גבעת הכלבים 25/11/2026 (א.40 + א.41) — additive, idempotent.
-- Appointment.assignedToUserId: team member assigned to the appointment (PlatformUser).
-- AvailabilityBlock.userId: null = whole business; set = one member's absence (no online-booking effect).
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;
ALTER TABLE "AvailabilityBlock" ADD COLUMN IF NOT EXISTS "userId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_assignedToUserId_fkey') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_assignedToUserId_fkey"
      FOREIGN KEY ("assignedToUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilityBlock_userId_fkey') THEN
    ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "Appointment_assignedToUserId_idx" ON "Appointment"("assignedToUserId");
CREATE INDEX IF NOT EXISTS "AvailabilityBlock_userId_idx" ON "AvailabilityBlock"("userId");
