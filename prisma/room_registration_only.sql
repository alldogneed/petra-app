-- "רישום בלבד" room flag: left out of occupancy + availability (additive, idempotent).
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "registrationOnly" BOOLEAN NOT NULL DEFAULT false;
