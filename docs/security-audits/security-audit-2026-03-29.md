# Petra App — Security & Bug Audit Report

**Date:** 2026-03-29
**Scope:** Comprehensive review of 309 API routes, authentication, authorization, input validation, data exposure, and error handling.

---

## Fixes Applied

### 1. IDOR Defence-in-Depth — Service Recipient Stages (MEDIUM)

**File:** `src/app/api/service-recipient-stages/[id]/route.ts`

The PATCH and DELETE mutations used `where: { id }` alone. While an ownership check (`findFirst` with `businessId`) existed before the mutation, the mutation itself did not enforce `businessId`. This creates a theoretical TOCTOU (time-of-check-time-of-use) window.

**Fix:** Changed `update` → `updateMany` and `delete` → `deleteMany` with `{ id, businessId }` in the WHERE clause, adding defence-in-depth.

---

### 2. Unhandled JSON.parse Exception — Tasks Audit (HIGH)

**File:** `src/app/api/tasks/[id]/audit/route.ts`

`JSON.parse(log.payload || "{}")` was called without try-catch. Malformed payload data in the database would crash the endpoint with an unhandled exception, potentially leaking stack traces.

**Fix:** Wrapped in try-catch that returns `{}` on parse failure.

---

### 3. Missing Rate Limiting — My-Booking Token Endpoint (MEDIUM)

**File:** `src/app/api/my-booking/[token]/route.ts`

Both GET and PATCH were public endpoints accepting arbitrary token values with no rate limiting. An attacker could enumerate valid booking tokens by brute-forcing the endpoint.

**Fix:** Added `STRICT_TOKEN` rate limiting (10 requests/minute per IP) to both GET and PATCH handlers.

---

## Audit Results — No Issues Found

### Authentication (309 routes audited)
All protected routes properly use `requireBusinessAuth()`, `requireOwnerAuth()`, or equivalent. Public routes (booking, auth, webhooks, cron) are appropriately scoped with token-based or secret-based auth where needed.

### SQL Injection
No vulnerabilities found. All raw SQL uses Prisma's parameterized `$queryRaw` template literals. No string concatenation in queries.

### Input Validation
Strong patterns across the codebase: Zod schema validation on request bodies, phone/email validation via `validation.ts`, search input clamped to 100 chars, pagination capped at 100 items, file upload whitelist with 10MB limit, CSV export with formula injection prevention.

### Rate Limiting
Comprehensive coverage on auth routes (login, register, 2FA, forgot-password, reset-password, OAuth), webhook endpoints, invoice operations, and sensitive token endpoints.

### Session Security
Properly configured: 256-bit tokens, SHA-256 hashing, HttpOnly + Secure + SameSite=Lax cookies, configurable TTL with remember-me support.

### Error Handling
Generic error messages returned to clients. Raw errors logged server-side only. No stack traces or internal details exposed in API responses.

### IDOR Prevention
All authenticated routes derive `businessId` from session. Database mutations on tables with direct `businessId` columns use it in WHERE clauses. Tables without direct `businessId` use the check-then-act pattern with ownership verified through relations.

### Timing Attack Prevention
Login uses `bcrypt.compare` with a dummy hash for non-existent users. Cron auth uses `crypto.timingSafeEqual`.

### Security Headers
HSTS, X-Frame-Options (DENY), CSP, X-Content-Type-Options (nosniff), Referrer-Policy all configured in `next.config.mjs`.

---

## Low-Priority Observations (Not Fixed)

1. **CSP includes `unsafe-eval`** — Required by Next.js in development but worth reviewing for production tightening.
2. **`getCurrentUser()` fetches `passwordHash` unnecessarily** — Used only to compute `hasPassword: boolean`. Not exposed in responses, but could be optimized to avoid loading the hash into memory.
3. **Sentry `beforeSend` could scrub PII** — Currently filters by NODE_ENV but doesn't redact sensitive data patterns from error messages before sending to external service.

---

## Summary

| Category | Status |
|---|---|
| Authentication coverage | ✅ All routes protected |
| SQL injection | ✅ None found |
| IDOR vulnerabilities | ⚠️ 1 fixed (service-recipient-stages) |
| Input validation | ✅ Comprehensive |
| Rate limiting | ⚠️ 1 gap fixed (my-booking) |
| Error handling | ⚠️ 1 crash fixed (tasks audit JSON.parse) |
| Session security | ✅ Properly configured |
| Security headers | ✅ Configured |
| Secrets in code | ✅ None found |
