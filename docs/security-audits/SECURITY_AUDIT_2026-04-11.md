# Petra App — Security & Bug Audit Report

**Date:** 2026-04-11
**Scope:** Comprehensive audit of API routes, authentication, session management, input validation, and common bugs.

---

## Summary

Audited ~120 API route files across the entire Petra application. Found and fixed **11 security vulnerabilities** and **3 critical bugs**. The application has solid foundational security (proper auth guards on all routes, bcrypt password hashing, CSRF-safe cookies), but had systematic IDOR vulnerabilities in POST endpoints and a TOTP timing attack.

---

## Issues Fixed

### CRITICAL — IDOR Vulnerabilities (Cross-Business Data Manipulation)

**Root cause:** POST endpoints accepted entity IDs (customerId, petId, serviceId, etc.) from request bodies without validating they belong to the authenticated business. An attacker with a valid session for Business A could create records referencing entities from Business B.

**Fixed in these routes:**

1. **`/api/appointments/route.ts`** — Added ownership validation for `customerId`, `petId`, `serviceId`, `priceListItemId` before creating appointments.

2. **`/api/payments/route.ts`** — Added ownership validation for `customerId`, `appointmentId`, `boardingStayId`, `orderId` before creating payments.

3. **`/api/orders/route.ts`** — Added ownership validation for `customerId` before creating orders.

4. **`/api/leads/route.ts`** — Added ownership validation for `customerId` before linking a lead to a customer.

5. **`/api/boarding/route.ts`** — Added ownership validation for `petId`, `customerId`, `roomId`, `yardId` before creating boarding stays.

6. **`/api/training-programs/route.ts`** — Added ownership validation for `dogId`, `customerId` before creating training programs.

### CRITICAL — TOTP Timing Attack

**File:** `src/lib/totp.ts`

**Issue:** TOTP verification used early return on match and non-constant-time string comparison (`===`), allowing attackers to narrow down correct codes via timing measurements.

**Fix:** Changed to use `crypto.timingSafeEqual()` for comparison and iterate through all windows before returning (no early return).

### CRITICAL — Pending Approvals Customer Delete Orphans Data

**File:** `/api/pending-approvals/[id]/route.ts`

**Issue:** The `DELETE_CUSTOMER` action in the approval executor called `prisma.customer.delete()` directly, skipping the 15-step cascading cleanup. This would leave orphaned records in InvoiceDocument, Payment, Appointment, Order, Pet, Task, and many other tables.

**Fix:** Replaced with the full cascading delete sequence matching the standard customer DELETE endpoint.

### HIGH — Login Rate Limiting Per-IP Only

**File:** `/api/auth/login/route.ts`

**Issue:** Login was rate-limited only per IP address. An attacker could attempt 10 logins per IP per 10 minutes against any specific email account.

**Fix:** Added a secondary per-email+IP rate limit (5 attempts per 15 minutes per email+IP combination) to prevent targeted brute-force attacks.

### HIGH — Session Cache Not Invalidated on Password Reset

**File:** `/api/auth/reset-password/route.ts`

**Issue:** After resetting a password and deleting all DB sessions, the in-memory session cache (30s TTL) was not cleared. Old sessions could still be used for up to 30 seconds.

**Fix:** Added `invalidateUserSessionCache(userId)` call immediately after the transaction.

### MEDIUM — Missing Error Handling

**Files:** `/api/system-messages/read-all/route.ts`, `/api/webhooks/lead/key/route.ts`

**Issue:** Database operations were not wrapped in try/catch, risking raw Prisma error leakage to clients.

**Fix:** Added proper try/catch with generic error messages.

---

## Remaining Issues (Not Fixed — Require Architectural Decisions)

### CRITICAL — In-Memory Rate Limiting Not Distributed

**File:** `src/lib/rate-limit.ts`

**Issue:** Rate limiting uses in-memory storage. On Vercel Serverless, each function instance has its own store, allowing attackers to bypass limits by hitting different instances.

**Recommendation:** Replace with Upstash Redis or Vercel KV for distributed rate limiting. This is already noted as "MVP" in code comments.

### HIGH — Insufficient 2FA Rate Limiting

**File:** `/api/auth/2fa/verify/route.ts`

**Issue:** 2FA verification allows 5 attempts per 5 minutes. Across enough windows, all 1M TOTP combinations could be tried. Backup codes are not separately rate-limited.

**Recommendation:** Reduce to 3 attempts per 15 minutes with exponential backoff. Apply the same rate limit to backup code attempts.

### HIGH — X-Forwarded-For Spoofing

**File:** `/api/auth/login/route.ts` (and other routes)

**Issue:** IP is extracted from the first value in `X-Forwarded-For`. If Vercel appends IPs to the right, an attacker can prepend arbitrary IPs to bypass rate limiting.

**Recommendation:** Use the rightmost (most recently added) IP, or use Vercel's `request.ip` property.

### MEDIUM — Stripe Webhook Idempotency

**File:** `/api/webhooks/stripe/route.ts`

**Issue:** No check for duplicate event processing. Webhook replays or retries could create duplicate Payment records.

**Recommendation:** Check for existing records with the same `stripePaymentIntentId` before inserting.

### MEDIUM — Appointment Double-Booking

**File:** `/api/appointments/route.ts`

**Issue:** No overlap check when creating appointments. Multiple appointments can be booked for the same time slot.

**Recommendation:** Add a `findFirst` query checking for overlapping `date`+`startTime`+`endTime` before creation.

### LOW — Session Cache TTL (30s) Privilege Window

**File:** `src/lib/session.ts`

**Issue:** Role changes take up to 30 seconds to propagate due to session caching.

**Recommendation:** Invalidate cache immediately on role/permission changes, or reduce TTL for admin operations.

---

## Positive Findings

The following security measures are properly implemented:

- All API routes use `requireBusinessAuth()` with `isGuardError()` — no missing auth guards found
- Password hashing uses bcrypt with 12 rounds
- Session tokens are 256-bit random, SHA-256 hashed for DB storage
- Cookies have HttpOnly, Secure (prod), SameSite=Lax flags
- Password reset tokens use atomic consumption to prevent race conditions
- Account enumeration is prevented (silent responses for nonexistent accounts)
- Login uses dummy bcrypt hash to prevent timing-based user enumeration
- Admin 2FA enforcement is in place for platform admin actions
- All individual resource endpoints (`[id]` routes) properly validate ownership
- Input validation (phone, email, name sanitization) is thorough
- No SQL injection risks — all queries use Prisma ORM
- IDOR prevention on businessId — always derived from session, never from request

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/totp.ts` | Constant-time TOTP comparison, no early return |
| `src/app/api/appointments/route.ts` | IDOR validation for customerId, petId, serviceId, priceListItemId |
| `src/app/api/payments/route.ts` | IDOR validation for customerId, appointmentId, boardingStayId, orderId |
| `src/app/api/orders/route.ts` | IDOR validation for customerId |
| `src/app/api/leads/route.ts` | IDOR validation for customerId |
| `src/app/api/boarding/route.ts` | IDOR validation for petId, customerId, roomId, yardId |
| `src/app/api/training-programs/route.ts` | IDOR validation for dogId, customerId |
| `src/app/api/pending-approvals/[id]/route.ts` | Full cascading delete for DELETE_CUSTOMER |
| `src/app/api/auth/login/route.ts` | Per-email+IP rate limiting |
| `src/app/api/auth/reset-password/route.ts` | Session cache invalidation after password reset |
| `src/app/api/system-messages/read-all/route.ts` | Added try/catch error handling |
| `src/app/api/webhooks/lead/key/route.ts` | Added try/catch error handling |
