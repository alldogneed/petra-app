-- Per-service online-booking hours (support ticket, גבעת הכלבים, 7/11/2026). Additive, idempotent.
ALTER TABLE "PriceListItem" ADD COLUMN IF NOT EXISTS "bookingHours" JSONB;
