-- "שמור זמנית – ממתין לחוזה" flag on boarding stays (additive, idempotent).
ALTER TABLE "BoardingStay" ADD COLUMN IF NOT EXISTS "isTentative" BOOLEAN NOT NULL DEFAULT false;
