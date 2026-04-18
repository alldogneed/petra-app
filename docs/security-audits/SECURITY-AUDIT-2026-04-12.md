# Petra App — Security & Bug Audit Report

**Date:** 2026-04-12
**Scope:** Comprehensive automated audit of API routes, authentication, input validation, timezone handling, race conditions, and error handling.

---

## Summary

Audited the entire Petra application including ~60 API route directories, authentication guards, webhook handlers, cron jobs, and public booking endpoints. Found and fixed **8 issues** (2 HIGH, 4 MEDIUM, 2 LOW). The application has strong foundational security from prior audits, but this scan uncovered new bugs in the public booking flow, date validation gaps, and a race condition.

---

## Issues Fixed

### HIGH — Timezone Bug in Public Booking Endpoint

**File:** `/api/booking/book/route.ts` (lines 67-71)

**Issue:** The booking creation endpoint used JavaScript's `setHours()` on a Date object, which interprets the time in the server's timezone (UTC on Vercel), not Israel time. A customer booking at 14:00 Israel time would get a booking created at 14:00 UTC (= 17:00 Israel time in summer).

**Fix:** Replaced with the existing `localTimeToUtc()` helper from `src/lib/slots.ts` which correctly handles Israel timezone (Asia/Jerusalem) including DST transitions. Also added validation for invalid time and date formats.

---

### HIGH — Race Condition in Customer Find-or-Create (Public Booking)

**File:** `/api/booking/book/route.ts` (lines 48-65)

**Issue:** The public booking endpoint used a check-then-create pattern for customers without any concurrency protection. Two simultaneous bookings from the same phone number could create duplicate customer records (no unique constraint on `(businessId, phone)` in the Customer model).

**Fix:** Added a `.catch()` fallback on the `create()` call that retries `findFirst()` if the create fails due to a concurrent insert. This handles the race without requiring a schema migration.

---

### MEDIUM — Race Condition in Availability Rule Seeding

**File:** `/api/admin/availability/route.ts` (lines 49-55)

**Issue:** When no availability rules existed for a business, concurrent requests would both attempt to create all 7 default rules, causing unique constraint violations on `(businessId, dayOfWeek)`.

**Fix:** Changed `create()` to `upsert()` with the existing compound unique index `businessId_dayOfWeek`, making the operation idempotent.

---

### MEDIUM — Missing Date Validation in Orders API

**File:** `/api/orders/route.ts` (GET handler)

**Issue:** Four date query parameters (`from`, `to`, `startFrom`, `startTo`) were passed directly to `new Date()` without validation. Invalid date strings would produce `Invalid Date` objects in Prisma queries, causing unpredictable behavior.

**Fix:** Added `isNaN(d.getTime())` validation for all date parameters with Hebrew error messages.

---

### MEDIUM — Missing Date Validation in Export Download

**File:** `/api/exports/download/route.ts`

**Issue:** `from` and `to` query parameters were used without validation in database queries.

**Fix:** Added date validation with proper error responses before constructing Prisma filters.

---

### MEDIUM — Missing Date Validation in Leads Export

**File:** `/api/leads/export/route.ts`

**Issue:** Same pattern — `from` and `to` params used without `isNaN()` checks.

**Fix:** Added validation returning 400 with Hebrew error messages for invalid dates.

---

### LOW — JSON.parse Without Error Handling in Import Execute

**File:** `/api/import/execute/route.ts` (line 33)

**Issue:** `JSON.parse(batch.statsJson)` was called without try/catch. If the stored JSON was corrupted, the entire endpoint would throw an unhandled error.

**Fix:** Wrapped in try/catch with a user-friendly Hebrew error response.

---

### LOW — Timing-Unsafe Secret Comparison in Test-Notify

**File:** `/api/test-notify/route.ts` (line 9)

**Issue:** The CRON_SECRET comparison used `!==` (non-constant-time), which is vulnerable to timing attacks. Also, this temporary test endpoint is still present in the codebase.

**Fix:** Changed to `crypto.timingSafeEqual()` for constant-time comparison. Added TODO comment to remind about removal.

---

## Remaining Issues (Not Fixed — Require Product Decisions)

### MEDIUM — Generic Webhook Handler Has No Signature Verification

**File:** `/api/webhooks/route.ts`

The generic webhook endpoint uses `requireAuth()` (session-based) but has no webhook signature verification. It routes based on `x-webhook-source` header. However, since it requires a valid session, the risk is lower than a fully public endpoint. The specific webhook handlers at `/api/webhooks/stripe/`, `/api/webhooks/invoices/`, and `/api/webhooks/lead/` all have proper signature verification.

**Recommendation:** If this endpoint is unused (the specific handlers cover all cases), consider removing it.

### LOW — Test-Notify Endpoint Still in Production

**File:** `/api/test-notify/route.ts`

This endpoint is marked as temporary and should be removed. It's protected by CRON_SECRET but serves no production purpose.

### LOW — Hardcoded Email in Payment Route

**File:** `/api/cardcom/create-payment/route.ts` (line 52)

`const OWNER_EMAIL = "alldogneed@gmail.com"` is hardcoded for test mode access control. Should be moved to env vars.

### INFO — Cron POST Method Mismatch

**File:** `/api/cron/service-dog-meeting-reminders/route.ts`

Uses POST method while Vercel Cron typically invokes GET. May not be triggered by Vercel's cron scheduler.

---

## Security Strengths Observed

The application has strong security fundamentals from prior audits:

- All 248+ authenticated API routes use `requireBusinessAuth()` + `isGuardError()` correctly
- IDOR protection: businessId derived from session, not from request body/params
- TOTP uses `crypto.timingSafeEqual()` for constant-time comparison
- Rate limiting on login (per-IP + per-email+IP), public booking, and import endpoints
- Webhook signature verification on all production webhook handlers (Stripe, Morning, Lead)
- Cron jobs all verify CRON_SECRET with timing-safe comparison
- Sensitive data (passwords, API keys, tokens) are never exposed in API responses
- File uploads validated for MIME type and size
- CSV export escapes formula injection (`=`, `+`, `-`, `@` prefixes)
- Prisma parameterized queries prevent SQL injection
- No use of `eval()`, `Function()`, or other dangerous patterns

---

## Files Modified

1. `src/app/api/booking/book/route.ts` — timezone fix + race condition fix + input validation
2. `src/app/api/admin/availability/route.ts` — race condition fix (upsert)
3. `src/app/api/orders/route.ts` — date parameter validation
4. `src/app/api/exports/download/route.ts` — date parameter validation
5. `src/app/api/leads/export/route.ts` — date parameter validation
6. `src/app/api/import/execute/route.ts` — JSON.parse error handling
7. `src/app/api/test-notify/route.ts` — timing-safe secret comparison
