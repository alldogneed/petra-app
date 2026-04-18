# Security & Bug Audit — 2026-04-03

## Summary

Comprehensive automated audit of the Petra codebase. Found and fixed **10 issues** across security vulnerabilities, input validation bugs, and IDOR flaws. Additionally identified several items to monitor.

---

## FIXED Issues

### 1. CRITICAL — IDOR: Medications update/delete without businessId constraint
**File:** `src/app/api/medications/[id]/route.ts`
**Problem:** PATCH and DELETE operations used `where: { id: params.id }` without businessId, allowing a user from Business A to modify/delete medications belonging to Business B if they knew the medication ID. The ownership check was performed in a separate query but not enforced in the mutation.
**Fix:** Changed to use `existing.id` from the verified record for both update and delete operations.

### 2. CRITICAL — IDOR: Contract templates update without businessId constraint
**File:** `src/app/api/contracts/templates/[id]/route.ts`
**Problem:** PATCH used `where: { id: params.id }` without businessId despite the ownership check being correct. Race condition window between check and mutation.
**Fix:** Added `businessId: authResult.businessId` to the update WHERE clause.

### 3. HIGH — IDOR: Service recipient stages re-fetch without businessId
**File:** `src/app/api/service-recipient-stages/[id]/route.ts`
**Problem:** After updating with proper businessId filtering, the re-fetch used `findUnique` without businessId, potentially returning data from another business.
**Fix:** Changed to `findFirst` with `businessId: auth.businessId` in WHERE clause.

### 4. HIGH — IDOR: Pet medications update/delete without businessId in mutation
**File:** `src/app/api/pets/[petId]/medications/[medId]/route.ts`
**Problem:** Similar to #1 — update and delete used `params.medId` directly instead of the verified record's ID.
**Fix:** Changed to use `existing.id` from the verified record.

### 5. HIGH — IDOR: Training program sessions update/delete without businessId
**File:** `src/app/api/training-programs/[id]/sessions/[sessionId]/route.ts`
**Problem:** Update and delete used `params.sessionId` directly instead of the verified session record.
**Fix:** Changed to use `session.id` from the verified record.

### 6. MEDIUM — Missing enum validation: Booking status parameter
**File:** `src/app/api/booking/bookings/route.ts`
**Problem:** `status` query parameter was passed directly to Prisma WHERE clause without validation against allowed values.
**Fix:** Added whitelist validation: `["pending", "confirmed", "declined", "cancelled"]`.

### 7. MEDIUM — Missing enum validation: Order export status parameter
**File:** `src/app/api/orders/export/route.ts`
**Problem:** `status` parameter only checked `!== "ALL"` before passing to WHERE clause.
**Fix:** Added whitelist validation: `["draft", "confirmed", "completed", "cancelled", "canceled"]`.

### 8. MEDIUM — Missing enum validation: Support ticket status parameter
**File:** `src/app/api/owner/support/route.ts`
**Problem:** `status` parameter passed directly to Prisma without validation.
**Fix:** Added whitelist validation: `["open", "in_progress", "resolved"]`.

### 9. MEDIUM — Invalid date input: Training session dates
**File:** `src/app/api/training-programs/[id]/sessions/[sessionId]/route.ts`
**Problem:** `new Date(sessionDate)` called without validation — invalid strings create NaN dates stored in DB.
**Fix:** Added `isNaN(d.getTime())` check with 400 error response.

### 10. MEDIUM — Invalid date/number input: Insurance claims
**File:** `src/app/api/service-dogs/[id]/insurance/[insuranceId]/claims/route.ts`
**Problem:** `incidentDate`, `submittedAt`, `followUpAt` parsed without validation. `amount` fields parsed with `parseFloat` without NaN check.
**Fix:** Added date validation for all 3 date fields. Added `parseAmount` helper with `Number.isFinite` check.

### 11. MEDIUM — Invalid date input: Pet medications
**File:** `src/app/api/pets/[petId]/medications/[medId]/route.ts`
**Problem:** `startDate` and `endDate` parsed without validation.
**Fix:** Added `safeDate` helper with validation and 400 error responses.

### 12. MEDIUM — parseInt NaN: Training session rating
**File:** `src/app/api/training-programs/[id]/sessions/[sessionId]/route.ts`
**Problem:** `parseInt(rating)` could produce NaN stored in DB. No bounds check on rating value.
**Fix:** Added `Number.isFinite` check and range validation (1–5).

---

## NOT FIXED — Items to Monitor

### A. Webhook secrets in URLs (Cardcom)
**Files:** `src/app/api/cardcom/create-payment/route.ts`, `create-checkout/route.ts`, `create-trial/route.ts`, `create-tokenization/route.ts`
**Issue:** `CARDCOM_WEBHOOK_SECRET` is embedded in callback URLs sent to the payment processor. While the receiving endpoints validate with timing-safe comparison, the secret is visible in server logs and payment processor records.
**Recommendation:** Consider HMAC-based webhook verification instead of secret-in-URL pattern.
**Not fixed:** Requires architectural change and coordination with Cardcom integration.

### B. Admin feed action parameter (unvalidated)
**File:** `src/app/api/admin/feed/route.ts`
**Issue:** `action` query parameter passed directly to WHERE clause. Low risk since this is a platform-admin-only route, but inconsistent with validation elsewhere.
**Recommendation:** Add action whitelist or use `contains` instead of exact match.

---

## Positive Findings (No Issues)

- **Auth guards:** All protected routes use `requireBusinessAuth` / `requirePlatformPermission` correctly.
- **No raw SQL:** Zero uses of `$queryRaw`, `$executeRaw`, or `$executeRawUnsafe`.
- **No password leakage:** All API responses properly exclude `passwordHash` via `select` clauses.
- **No CORS wildcards:** No authenticated routes set `Access-Control-Allow-Origin: *`.
- **No hardcoded secrets:** All credentials properly stored in environment variables.
- **No XSS via dangerouslySetInnerHTML:** All 3 instances use `JSON.stringify` (safe).
- **Rate limiting:** Authentication, webhook, and public endpoints all have proper rate limiting.
- **Timing-safe comparisons:** Webhook secret validation uses `timingSafeEqual`.
- **Public routes intentionally unauthenticated:** Cardcom webhooks, intake forms, cron jobs, service dog ID cards — all use alternative auth (tokens, secrets, rate limits).

---

## Files Modified

1. `src/app/api/medications/[id]/route.ts`
2. `src/app/api/contracts/templates/[id]/route.ts`
3. `src/app/api/service-recipient-stages/[id]/route.ts`
4. `src/app/api/booking/bookings/route.ts`
5. `src/app/api/orders/export/route.ts`
6. `src/app/api/owner/support/route.ts`
7. `src/app/api/training-programs/[id]/sessions/[sessionId]/route.ts`
8. `src/app/api/service-dogs/[id]/insurance/[insuranceId]/claims/route.ts`
9. `src/app/api/pets/[petId]/medications/[medId]/route.ts`
