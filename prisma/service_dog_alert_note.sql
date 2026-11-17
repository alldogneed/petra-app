-- Pop-up note on a service dog's file (support ticket סימבה, 16/11/2026). Additive.
ALTER TABLE "ServiceDogProfile" ADD COLUMN IF NOT EXISTS "alertNote" TEXT;
