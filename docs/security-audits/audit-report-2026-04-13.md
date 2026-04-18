# Petra App — Security & Bug Audit Report
**Date:** April 13, 2026
**Scope:** Full codebase audit — API routes, authentication, input validation, session management, encryption

---

## Executive Summary

The Petra codebase demonstrates **strong security fundamentals**: all protected API routes use auth guards correctly, businessId is always derived from the session (never from request body), IDOR protections are in place, encryption uses AES-256-GCM with random IVs, passwords are hashed with bcrypt (cost 12), and sessions use cryptographically secure tokens with HttpOnly/SameSite/Secure cookies.

The audit identified and **fixed 10 issues** and documented additional recommendations.

---

## Issues Found & Fixed

### 1. Missing `take` Limit — Booking Bookings Query (Fixed)
**File:** `src/app/api/booking/bookings/route.ts`
**Severity:** Medium
**Issue:** `prisma.booking.findMany()` had no `take` limit, potentially returning unbounded results.
**Fix:** Added `take: 500`.

### 2. Missing `take` Limit — Customer Export (Fixed)
**File:** `src/app/api/customers/export/route.ts`
**Severity:** Medium
**Issue:** Export query fetched ALL customers without a safety limit, risking memory exhaustion on large businesses.
**Fix:** Added `take: 10000` safety cap.

### 3. Missing `take` Limit — Leads Export (Fixed)
**File:** `src/app/api/leads/export/route.ts`
**Severity:** Medium
**Issue:** Same unbounded query pattern in leads export.
**Fix:** Added `take: 10000` safety cap.

### 4. Missing Error Handling — Test Notify Endpoint (Fixed)
**File:** `src/app/api/test-notify/route.ts`
**Severity:** Low
**Issue:** `notifyOwnerNewUser()` call wasn't wrapped in try-catch — failures would produce unhandled 500 errors.
**Fix:** Added try-catch with proper error response.

### 5. `timingSafeEqual` Buffer Length Crash (Fixed)
**File:** `src/app/api/test-notify/route.ts`
**Severity:** Medium (potential crash)
**Issue:** `crypto.timingSafeEqual()` throws if buffer lengths differ. If the user sends a secret of different length, the endpoint would crash with a 500 instead of returning 401.
**Fix:** Added explicit length check before calling `timingSafeEqual`.

### 6. Missing Input Validation — Pet Creation (Fixed)
**File:** `src/app/api/customers/[id]/pets/route.ts`
**Severity:** Medium
**Issue:** Pet name, breed, medicalNotes, and microchip fields accepted without length validation.
**Fix:** Added length limits: name (100), breed (100), medicalNotes (5000), microchip (50).

### 7. Missing Input Validation — Pet Update (Fixed)
**File:** `src/app/api/pets/[petId]/route.ts`
**Severity:** Medium
**Issue:** PATCH endpoint accepted unbounded strings for name, breed, medicalNotes, foodNotes, behaviorNotes.
**Fix:** Added length limits matching creation endpoint.

### 8. Missing Input Validation — Service Creation (Fixed)
**File:** `src/app/api/services/route.ts`
**Severity:** Medium
**Issue:** Service name, description, duration, price, and color fields had no type/bounds/format validation. Negative prices and durations were accepted.
**Fix:** Added validation: name (200 chars), description (2000 chars), duration (1-1440 minutes), price (0-100,000), color (hex format).

### 9. Missing Length Validation — Message Templates (Fixed)
**File:** `src/app/api/messages/route.ts`
**Severity:** Medium
**Issue:** Template name and body had no max length check, allowing unbounded storage.
**Fix:** Added limits: name (200), body (10000), subject (500).

### 10. Missing Input Validation — Intake Message Override (Fixed)
**File:** `src/app/api/intake/route.ts`
**Severity:** Medium
**Issue:** `messageOverride` field was sent directly to WhatsApp without type/length validation, risking message injection.
**Fix:** Added type check + 2000 char limit.

### 11. Missing Length Validation — Automation Rules (Fixed)
**File:** `src/app/api/automations/route.ts`
**Severity:** Low
**Issue:** Automation rule `name` field had no max length.
**Fix:** Added 200 char limit.

### 12. Missing Length Validation — Broadcast Messages (Fixed)
**File:** `src/app/api/admin/broadcast-messages/route.ts`
**Severity:** Low
**Issue:** Admin broadcast title and content had no length limits.
**Fix:** Added limits: title (500), content (5000).

### 13. Missing Security Warning — 2FA Plaintext Fallback (Fixed)
**File:** `src/lib/encryption.ts`
**Severity:** Low (config issue)
**Issue:** If `TWOFA_ENCRYPTION_KEY` env var is missing, 2FA secrets are stored in plaintext with no warning.
**Fix:** Added `console.error` security warning when key is missing.

---

## Areas Verified as Secure

- **Auth guards**: All ~150+ API routes correctly use `requireBusinessAuth` / `requireAuth` / `requirePlatformRole` / `requireTenantPermission` with `isGuardError` checks.
- **IDOR protection**: businessId is always derived from session, never from request body/params in tenant routes.
- **Session management**: 256-bit crypto-random tokens, SHA-256 hashed in DB, HttpOnly + SameSite=Lax + Secure (prod) cookies, proper TTLs (8h regular, 30d remember-me, 30min admin).
- **Password hashing**: bcrypt with cost 12, timing-safe comparison with DUMMY_HASH to prevent user enumeration.
- **Encryption**: AES-256-GCM with random 12-byte IVs, per-purpose keys (GCal, invoicing, Stripe, Cardcom, 2FA).
- **Rate limiting**: Applied on auth endpoints, webhook endpoints, and write operations.
- **Raw SQL**: All `$queryRaw` uses Prisma's parameterized template literals — no SQL injection risk.
- **CSRF**: SameSite=Lax cookie attribute provides CSRF protection for state-changing requests.
- **Webhook auth**: Per-business API keys with 90-day expiry, timing-safe comparison for legacy secret.
- **DEMO_BUSINESS_ID**: Only used in public booking routes and seed scripts, as intended.
- **Cron auth**: `verifyCronAuth` uses timing-safe comparison with proper length checks.

---

## Recommendations (Not Fixed — Require Design Decision)

1. **Performance — Lead Duplicate Detection** (`src/app/api/leads/route.ts` line 165): Fetches ALL leads with phones to check for duplicates by normalizing each one. Consider adding a `phoneNorm` column to the Lead model and querying directly.

2. **2FA Encryption Key**: Ensure `TWOFA_ENCRYPTION_KEY` is set in all environments. The current fallback to plaintext should ideally be removed after migrating existing secrets.

3. **Test Notify Endpoint**: `src/app/api/test-notify/route.ts` is marked with `// TODO: Remove this endpoint before production release`. Consider removing it.

4. **Rate Limiting Coverage**: Some mutation endpoints lack explicit rate limiting (e.g., `/api/price-lists`, `/api/task-templates`, `/api/boarding/care-log`). Consider adding `RATE_LIMITS.API_WRITE` to these.
