# Petra App — Security & Bug Audit Report
**Date:** 2026-04-06
**Scope:** All 309 API routes + core libraries

---

## Executive Summary

A comprehensive audit was conducted across all API routes, authentication flows, input validation, data exposure patterns, and security headers. The codebase demonstrates **strong overall security posture** — proper session management, IDOR protection, rate limiting on sensitive endpoints, timing-safe comparisons, and comprehensive security headers.

**12 issues were identified and fixed** (8 high-severity, 4 medium-severity). All were related to overly broad Prisma queries loading sensitive fields into memory and raw error messages leaking internal details to clients.

---

## Issues Found & Fixed

### HIGH: Overly Broad `platformUser` Queries (8 fixes)

Multiple API routes queried `platformUser` without a `select` clause, loading **all fields** — including `passwordHash`, `twoFaSecret`, and `twoFaBackupCodes` — into Node.js heap memory. While these fields were not returned in API responses, unnecessary loading increases the attack surface for memory dumps, error logs, or debugging leaks.

| File | Fix Applied |
|------|------------|
| `api/owner/tenants/[tenantId]/members/route.ts` | Added `select: { id, email, name, isActive, role, platformRole }` |
| `api/owner/tenants/route.ts` | Added `select: { id: true }` (existence check) |
| `api/owner/users/route.ts` | Added `select: { id: true }` (existence check) |
| `api/auth/register/route.ts` | Added `select: { id: true }` (existence check) |
| `api/auth/google/callback/route.ts` | Added `select` with only needed fields (id, email, name, googleId, avatarUrl, passwordHash, authProvider, isActive) |
| `api/auth/2fa/enroll/route.ts` | Added `select: { id, email, twoFaEnabled }` |
| `api/auth/2fa/confirm/route.ts` | Added `select: { id, twoFaSecret, twoFaEnabled, platformRole }` |
| `api/auth/2fa/verify/route.ts` | Added `select: { id, twoFaEnabled, twoFaSecret, twoFaBackupCodes, platformRole }` |
| `api/admin/[businessId]/members/route.ts` | Added `select: { id, email, name, isActive }` |

### MEDIUM: Raw Error Messages Exposed to Clients (3 fixes)

Three routes returned `error.message` directly in JSON responses, potentially leaking SQL errors, Prisma constraint violations, or third-party API details.

| File | Before | After |
|------|--------|-------|
| `api/customers/[id]/route.ts` | `שגיאה בעדכון הלקוח: ${msg}` | `שגיאה בעדכון הלקוח` |
| `api/payments/stripe/payment-link/route.ts` | Raw Stripe error | `שגיאה ביצירת קישור תשלום` |
| `api/invoicing/issue/route.ts` | Raw provider error (2 places) | `שגיאה בהנפקת מסמך` |

---

## Areas Audited — No Issues Found

### Authentication & Authorization ✅
- All 309 routes have proper auth guards (`requireBusinessAuth`, `requirePlatformPermission`, `requirePlatformRole`, `resolveSession`, `verifyCronAuth`, or are legitimately public)
- No IDOR vulnerabilities — `businessId` always derived from session, never from request
- Cron routes use `crypto.timingSafeEqual()` for CRON_SECRET verification
- Impersonation restricted to SUPER_ADMIN with audit logging

### Input Validation ✅
- Zod schemas used consistently for request body validation
- Israeli phone/email validation via `src/lib/validation.ts`
- Integer parsing uses `Math.min`/`Math.max` clamping
- Notes length capped at 2000 chars

### Injection Prevention ✅
- Only 2 raw SQL queries found, both using safe `Prisma.sql` parameterized queries
- No string interpolation in SQL
- `sanitizeName()` applied where needed
- No user-generated HTML injection points

### Rate Limiting ✅
- Login: 25 attempts / 15 min
- Register: 5 attempts / 15 min
- Forgot Password: 3 attempts / 15 min
- Reset Password: 10 attempts / 15 min
- 2FA verify/confirm: rate-limited per user

### Session Security ✅
- SHA-256 hashed tokens (not plaintext in DB)
- HttpOnly, Secure, SameSite=strict cookies
- 8h default TTL, 30d with remember-me
- Token format validation in middleware (`/^[0-9a-f]{64}$/`)
- Session invalidation on password change

### Security Headers ✅ (next.config.mjs)
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy with proper directives
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: restricts camera, microphone, geolocation

### Other ✅
- No hardcoded secrets — all via environment variables
- Server-only env vars properly gated via `src/lib/env.ts`
- No CORS misconfiguration (same-origin default)
- No prototype pollution vectors
- No path traversal vectors (file uploads go to S3 with auto-generated names)
- Bcrypt cost factor 12 for password hashing
- Dummy hash pattern prevents user enumeration on login

---

## Verification

- TypeScript compilation passes with zero errors after all changes
- Production schema (`schema.production.prisma`) unchanged (no DB modifications needed)
