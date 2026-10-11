-- One-time data fix: Order.startAt / Order.endAt were stored 2-3h late.
--
-- Cause: the order form sent Israel wall-clock strings without an offset
-- ("2026-07-16T18:00:00") and the server (UTC) stored them as 18:00 UTC = 21:00 Israel.
-- Fixed in code by src/lib/order-time.ts (parseOrderDateTime). Rows written BEFORE that
-- deploy hold the Israel wall-clock time in a UTC column; convert them to the real instant.
--
-- Columns are `timestamp without time zone` holding UTC:
--   ("startAt" AT TIME ZONE 'Asia/Jerusalem')  → read the stored value as Israel local time
--   ... AT TIME ZONE 'UTC'                      → back to a UTC timestamp
-- DST-correct per row (summer +3h, winter +2h).
--
-- Idempotent: every corrected row is recorded in "_OrderTimeFix"; a second run skips it.
-- Only rows created before :cutoff (the deploy time of the code fix, UTC) are touched.
-- Run once:  psql "$DIRECT_URL" -v cutoff="'2026-10-11 12:00:00'" -f prisma/fix_order_start_times.sql

CREATE TABLE IF NOT EXISTS "_OrderTimeFix" (
  "orderId"    TEXT PRIMARY KEY,
  "oldStartAt" TIMESTAMP(3),
  "oldEndAt"   TIMESTAMP(3),
  "fixedAt"    TIMESTAMP(3) NOT NULL DEFAULT now()
);

WITH targets AS (
  SELECT o.id, o."startAt", o."endAt"
  FROM "Order" o
  WHERE o."createdAt" < :cutoff::timestamp
    AND (o."startAt" IS NOT NULL OR o."endAt" IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM "_OrderTimeFix" f WHERE f."orderId" = o.id)
),
logged AS (
  INSERT INTO "_OrderTimeFix" ("orderId", "oldStartAt", "oldEndAt")
  SELECT id, "startAt", "endAt" FROM targets
  RETURNING "orderId"
)
UPDATE "Order" o
SET "startAt" = CASE WHEN o."startAt" IS NULL THEN NULL
                     ELSE (o."startAt" AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC' END,
    "endAt"   = CASE WHEN o."endAt" IS NULL THEN NULL
                     ELSE (o."endAt" AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'UTC' END
FROM logged l
WHERE o.id = l."orderId";
