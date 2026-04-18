# Petra App — Security & Bug Audit Report

**Date:** 2026-04-07
**Scope:** Full codebase (309 API routes, auth system, client components)
**Auditor:** Automated scheduled task

---

## Summary

Audited the entire Petra codebase for security vulnerabilities and bugs. Found **6 issues that were fixed** and **4 advisory items** requiring manual attention.

### Fixed Issues

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | HIGH | Session fixation in Google OAuth — no prior session invalidation | `api/auth/google/callback/route.ts` |
| 2 | HIGH | SameSite=Lax on OAuth cookie (should be Strict) | `api/auth/google/callback/route.ts` |
| 3 | HIGH | Race condition in password reset token consumption | `api/auth/reset-password/route.ts` |
| 4 | HIGH | IDOR in admin availability — businessId accepted from request params without ownership check | `api/admin/availability/route.ts` |
| 5 | MEDIUM | Hardcoded lead stage strings ("won"/"lost"/"new") instead of DB UUIDs | `components/leads/LeadTreatmentModal.tsx` |
| 6 | LOW | `parseInt` without radix in CIDR matching + XSS hardening for JSON-LD | `lib/auth-guards.ts`, `book/[slug]/layout.tsx` |

### Advisory Items (Require Manual Action)

| # | Severity | Issue | Recommendation |
|---|----------|-------|----------------|
| A1 | MEDIUM | In-memory rate limiter doesn't work across serverless instances | Integrate Upstash Redis for distributed rate limiting |
| A2 | MEDIUM | 2FA backup codes use bcrypt cost 10 (passwords use 12) | Align to cost 12 in `api/auth/2fa/confirm/route.ts` |
| A3 | LOW | Session cache (30s TTL) delays logout propagation | Consider reducing to 10-15s |
| A4 | LOW | Console.error logs full error objects in auth routes | Redact to `error.message` only |

---

## Detailed Fix Descriptions

### Fix 1: Session Fixation in Google OAuth

**Before:** New session created without invalidating old ones. An attacker could maintain a parallel valid session.

**After:** Added `prisma.adminSession.deleteMany({ where: { userId: user.id } })` before `createSession()`, matching the pattern already used in the login endpoint.

### Fix 2: OAuth Cookie SameSite

**Before:** `sameSite: "lax"` — allows cross-site cookie transmission on top-level navigations, creating a CSRF window.

**After:** `sameSite: "strict"` — matches all other auth cookie settings in the app.

### Fix 3: Password Reset Race Condition

**Before:** Token validation (exists, not used, not expired) happened in a separate read query, with the actual consumption happening later in a transaction. Two simultaneous requests could both pass validation.

**After:** Added atomic token consumption using `updateMany` with `where: { id, usedAt: null, expiresAt: { gt: new Date() } }` — only one request can succeed. The subsequent password update transaction no longer includes the token update (already consumed).

### Fix 4: Admin Availability IDOR

**Before:** Both GET and PUT handlers accepted `businessId` from query params / request body without checking if the caller has access to that business.

**After:** Added ownership validation — if a `businessId` is provided, the route now checks that the caller either has an active membership in that business OR is a `super_admin`. Returns 403 otherwise.

### Fix 5: Hardcoded Lead Stage Strings

**Before:** `isClosed` check compared `lead.stage` against literal strings `"won"` and `"lost"`. Default stage was hardcoded as `"new"`.

**After:** Uses `wonStage.id` and `lostStage.id` from the stages array (queried from DB). Default stage uses `stages[0]?.id`.

### Fix 6: Minor Hardening

- `parseInt(bits)` changed to `parseInt(bits, 10)` in CIDR matching to prevent octal parsing.
- JSON-LD output escaped with `.replace(/</g, "\\u003c")` to prevent `</script>` injection in business names.

---

## Positive Security Observations

The codebase demonstrates strong security practices overall:

- All 309 API routes were audited; authentication guards are consistently applied
- IDOR protection is correct in all tenant routes (businessId derived from session)
- Input validation via `validation.ts` (phone, email, name sanitization) is thorough
- SQL injection prevention: all `$queryRaw` calls use Prisma's parameterized template literals
- No `eval()` or `new Function()` anywhere in the codebase
- Rate limiting on all sensitive auth endpoints (login, register, forgot-password, 2FA)
- File upload validation: 10MB limit, extension whitelist, URL domain check
- Strong passwords enforced (12+ chars, mixed case + digits)
- Bcrypt cost 12 for password hashing
- Timing-attack prevention with dummy hash comparison on login
- Session fixation protection on login (now also on OAuth)
- CSRF state validation on OAuth flow
- Audit logging for security events
- User enumeration prevention on forgot-password
- `.env` files properly gitignored

---

## TypeScript Verification

All fixes pass `tsc --noEmit` with zero errors.
