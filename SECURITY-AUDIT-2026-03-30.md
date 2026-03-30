# Petra App — Security & Bug Audit Report
**Date:** 2026-03-30 (Automated Scan)

---

## Summary

A comprehensive audit of the Petra app codebase covering authentication, authorization, input validation, session management, encryption, and common bug patterns. **7 issues found and fixed**, no critical security vulnerabilities discovered.

---

## Areas Audited

1. **Authentication guards** — All 100+ API routes checked for proper auth
2. **IDOR (Insecure Direct Object Reference)** — businessId derivation from session
3. **Input validation** — SQL injection, XSS, path traversal, JSON.parse safety
4. **Session management** — Token generation, cookie settings, expiry, 2FA
5. **Encryption** — Algorithm, key management, token generation
6. **Rate limiting** — Sensitive endpoints coverage
7. **Common bugs** — Null safety, error handling, memory leaks, pagination

---

## Security Strengths (No Action Needed)

| Area | Finding |
|------|---------|
| **Auth guards** | All protected routes use `requireBusinessAuth`/`requirePlatformPermission` correctly |
| **IDOR prevention** | `businessId` always derived from session, never from request body/params |
| **Password hashing** | bcryptjs with 12 rounds, timing-safe dummy hash for non-existent users |
| **Session tokens** | 256-bit crypto random, SHA-256 hashed before DB storage |
| **Cookie security** | HttpOnly, Secure (prod), SameSite=Lax, proper MaxAge |
| **Encryption** | AES-256-GCM with random IV, keys in env vars only |
| **Rate limiting** | All auth routes, webhooks, and sensitive endpoints covered |
| **2FA** | TOTP + bcrypt-hashed backup codes, enforced for platform admins |
| **Password reset** | One-time use tokens, 1-hour expiry, all sessions invalidated after reset |
| **CSRF** | OAuth state token validation, SameSite cookies |
| **SQL injection** | All queries via Prisma ORM (parameterized), no raw SQL found |
| **XSS** | Input sanitization via `validation.ts`, HTML tag stripping |
| **CSV injection** | Export routes prefix formula chars (`=`,`+`,`-`,`@`) with tab |
| **Cron auth** | `crypto.timingSafeEqual` for secret comparison |
| **No hardcoded secrets** | All credentials in environment variables |

---

## Issues Found & Fixed

### 1. Unprotected `JSON.parse` in 2FA Backup Codes (Medium)
- **File:** `src/app/api/auth/2fa/verify/route.ts:61`
- **Issue:** `JSON.parse(user.twoFaBackupCodes)` had no try/catch. If backup codes were corrupted in DB, the route would crash with an unhandled exception.
- **Fix:** Wrapped in try/catch with error logging; falls back to empty array on parse failure.

### 2. Memory Leak — Uncleaned Timeouts (Medium)
- **File:** `src/app/landing/_components/WhatsAppMockupAnimated.tsx:31-40`
- **Issue:** `runSequence()` created 3 `setTimeout` calls that were never stored or cleaned up. On component unmount, these would continue firing state updates on an unmounted component.
- **Fix:** Moved `runSequence` inside `useEffect`, stored timeout IDs, and added cleanup via `timeoutIds.forEach(clearTimeout)` in the effect destructor.

### 3. Missing Error Handling — Customers Export (Medium)
- **File:** `src/app/api/customers/export/route.ts`
- **Issue:** No try/catch around Prisma query + CSV generation. Database errors would crash the route.
- **Fix:** Added try/catch with structured error response.

### 4. Missing Error Handling — Pending Approvals (Low)
- **File:** `src/app/api/pending-approvals/route.ts`
- **Issue:** No try/catch around Prisma query.
- **Fix:** Added try/catch with structured error response.

### 5. Missing Error Handling — User Notifications (Low)
- **File:** `src/app/api/user-notifications/route.ts`
- **Issue:** No try/catch around Prisma query.
- **Fix:** Added try/catch with structured error response.

### 6. Missing Error Handling — Admin Feed (Low)
- **File:** `src/app/api/admin/feed/route.ts`
- **Issue:** No try/catch around Prisma query.
- **Fix:** Added try/catch with structured error response.

### 7. Pagination NaN Safety — Admin Feed (Low)
- **File:** `src/app/api/admin/feed/route.ts:12`
- **Issue:** `parseInt(searchParams.get("limit"))` could return `NaN` for non-numeric input, causing `take: NaN` in Prisma query which would error.
- **Fix:** Added `Number.isFinite` check with fallback to default (50), plus radix parameter.

---

## Recommendations (Not Fixed — Require Product Decision)

1. **In-memory rate limiting** (`src/lib/rate-limit.ts`): Currently uses JS object — works for single-instance deployment but won't scale to multiple instances. Consider migrating to Upstash Redis when scaling.

2. **Webhook secret in URL** (`src/app/api/cardcom/create-payment/route.ts:77`): Cardcom webhook secret embedded in URL query parameter — may appear in access logs. Low risk since it's server-to-server, but consider header-based auth if Cardcom supports it.

3. **Session cache** (`src/lib/session.ts`): Uses simple FIFO eviction with 500-entry limit. Consider LRU if session cache misses become a performance concern.

---

## Verification

All fixes pass TypeScript compilation (`tsc --noEmit`) with zero errors.
