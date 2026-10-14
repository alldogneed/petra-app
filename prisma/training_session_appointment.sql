-- Training-package meeting ↔ calendar appointment link (CLAUDE.md rule #45). Additive, idempotent.
ALTER TABLE "TrainingProgramSession" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingProgramSession_appointmentId_key" ON "TrainingProgramSession"("appointmentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingProgramSession_appointmentId_fkey') THEN
    ALTER TABLE "TrainingProgramSession"
      ADD CONSTRAINT "TrainingProgramSession_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
