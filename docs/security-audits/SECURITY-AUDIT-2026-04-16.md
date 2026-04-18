# Security & Bug Audit Report — 2026-04-16

**Status:** PARTIAL — Filesystem deadlock prevented full code review  
**Auditor:** Automated scheduled task  
**Scope:** Petra App (Next.js SaaS application)

---

## Executive Summary

A comprehensive security audit was attempted on the Petra App codebase. Due to a persistent filesystem deadlock (EDEADLK error on all file read operations), **the audit could not inspect source code contents**. This report provides findings based on structural analysis (directory structure, file sizes, file names, and architecture patterns) and flags areas that require manual review.

**The filesystem deadlock itself is a critical operational issue** that should be resolved before the next audit cycle.

---

## Critical Operational Issue

### 1. Filesystem Deadlock (SEVERITY: CRITICAL)

All file read operations on the mounted filesystem return `EDEADLK (Resource deadlock avoided)`. This affects:
- All source files under `src/`
- All configuration files (`.env*`, `next.config.mjs`, `vercel.json`, `package.json`)
- Git repository objects (`.git/`)
- The git repository HEAD ref is corrupted — `git log` returns "your current branch appears to be broken"

**Impact:** Cannot deploy, build, or audit the application from this environment.  
**Recommended Action:** Restart the environment or remount the filesystem. Investigate if a background process is holding file locks.

---

## Structural Analysis Findings

### 2. Multiple Environment Files in Project Root (SEVERITY: HIGH)

The following `.env` files exist in the project root:

| File | Size | Risk |
|------|------|------|
| `.env` | 3.9 KB | Production secrets — should never be in repo |
| `.env.local` | 4.1 KB | Local development secrets |
| `.env.production` | 3.7 KB | Production config |
| `.env.staging` | 3.8 KB | Staging config |
| `.env.vercel` | 3.0 KB | Vercel-specific secrets |
| `.env.vercel-temp` | 2.8 KB | Temporary Vercel secrets |
| `.env.pulled` | 5.2 KB | Pulled/synced secrets |
| `.env 2.example` | 4.2 KB | Malformed filename (space in name) |

**Concerns:**
- Cannot verify `.gitignore` excludes all `.env` files (filesystem locked)
- The `.env 2.example` file has a space in the name — likely an accidental duplicate
- `.env.pulled` suggests secrets were synced from a remote source; verify this file is gitignored
- `.env.vercel-temp` should be cleaned up if no longer needed

**Recommended Action:** 
- Verify `.gitignore` contains entries for all `.env*` files (except `.env.example`)
- Delete `.env 2.example` (duplicate with malformed name)
- Delete `.env.vercel-temp` if not needed
- Run `git log --all --diff-filter=A -- '.env*'` to check if any secrets were ever committed

### 3. Seed Route Accessible (SEVERITY: HIGH)

File exists: `src/app/api/seed/route.ts`

Seed routes are meant for development/testing and can insert test data or reset database state. If accessible in production without proper auth checks, this could lead to data corruption or data loss.

**Recommended Action:** Verify this route is disabled in production via environment check or removed entirely.

### 4. Large Attack Surface — 316 API Routes (SEVERITY: MEDIUM)

The application has **316 API route files**, which is a very large attack surface. Key areas requiring careful authorization checks:

- **Owner routes** (super-admin): `src/app/api/owner/` — 15+ routes including impersonation, tenant management, user management, broadcast
- **Admin routes**: `src/app/api/admin/` — migration execution, user management, stats
- **Cron routes**: 9 cron endpoints that must be protected from unauthorized invocation
- **Payment/billing routes**: CardCom integration (9 routes), Stripe webhooks, billing events
- **Data export routes**: Customer export, pet export, lead export, boarding export, analytics export — all risk data exfiltration
- **File/document routes**: Customer documents, pet attachments, contract PDFs — risk file path traversal

### 5. Cron Endpoints Need Authentication (SEVERITY: HIGH)

Nine cron endpoints exist:
- `cron/birthday-reminders`
- `cron/charge-trials`
- `cron/expire-subscriptions`
- `cron/generate-tasks`
- `cron/send-reminders`
- `cron/service-dog-alerts`
- `cron/service-dog-meeting-reminders`
- `cron/trial-reminders`
- `cron/vaccination-reminders`

A `cron-auth.ts` file exists (1 KB) which likely implements authentication. However, `charge-trials` and `expire-subscriptions` are particularly sensitive as they affect billing.

**Recommended Action:** Verify all cron routes use the cron-auth guard and that the auth mechanism uses a strong secret (not a simple static token).

### 6. Impersonation Feature (SEVERITY: HIGH)

Files found:
- `src/app/api/owner/tenants/[tenantId]/impersonate/route.ts`
- `src/app/api/auth/exit-impersonation/route.ts`

Impersonation allows an owner/admin to act as another user. This is a powerful feature that requires:
- Strict authorization (owner-only)
- Full audit logging
- Session isolation
- Time-limited impersonation tokens

**Recommended Action:** Verify impersonation is restricted to verified owner accounts, logs all actions, and auto-expires.

### 7. Token-Based Public Routes (SEVERITY: MEDIUM)

Several routes use URL tokens for authentication-less access:
- `my-booking/[token]` — Customer booking management
- `intake/[token]` — Intake form submission
- `sign/[token]` — Contract signing + PDF generation
- `service-dogs/id-card/[token]` — Service dog ID card

**Concerns:**
- Token entropy must be sufficient (at least 32 bytes / 256 bits)
- Tokens should expire after use or after a time limit
- Rate limiting should prevent token brute-forcing
- Error responses should not reveal whether a token exists

### 8. Payment Webhook Security (SEVERITY: HIGH)

CardCom and Stripe webhook endpoints:
- `cardcom/indicator` — payment indicator callback
- `cardcom/checkout-indicator` — checkout callback
- `cardcom/trial-indicator` — trial callback
- `webhooks/stripe` — Stripe webhook

**Recommended Action:** Verify all webhook endpoints validate request signatures to prevent forged payment notifications.

### 9. Data Migration Routes (SEVERITY: MEDIUM)

Routes exist for data migration:
- `admin/migration/parse`
- `admin/migration/execute`
- `admin/migration/businesses`
- `admin/migration/template`
- `import/parse`, `import/execute`

These routes handle bulk data operations and file uploads. Verify input validation, file type restrictions, and authorization checks.

### 10. Encryption Module (SEVERITY: MEDIUM)

`src/lib/encryption.ts` (5.4 KB) exists, recently modified on April 13. The file was likely updated in the previous audit cycle. Verify:
- AES-256-GCM or equivalent is used
- Encryption keys are properly managed (not hardcoded)
- IV/nonce is unique per encryption operation

---

## Security Architecture Observations (Positive)

Based on file structure, the application appears to have:
- **Auth guards** (`auth-guards.ts`, 11.3 KB) — comprehensive authorization layer
- **Rate limiting** (`rate-limit.ts` + `security/redis-rate-limiter.ts`) — both in-memory and Redis-based
- **Permissions system** (`permissions.ts`, 11 KB + tests) — role-based access control
- **Cron authentication** (`cron-auth.ts`) — dedicated cron route protection
- **TOTP/2FA** (`totp.ts` + auth/2fa routes) — two-factor authentication support
- **Audit logging** (`audit.ts`) — activity tracking
- **Input validation** (`validation.ts`) — centralized validation
- **CardCom security helpers** (`security/cardcom-helpers.ts`) — payment security
- **Sentry integration** — error monitoring and tracking
- **Middleware** (`middleware.ts`) — request-level security checks

---

## Recommendations for Next Audit

1. **Resolve the filesystem deadlock** — this is blocking all code-level analysis
2. **Fix the corrupted git repository** — `git fsck` and potentially re-clone from remote
3. **Run `npm audit`** to check for vulnerable dependencies
4. **Run static analysis** (ESLint security plugins, Semgrep, or similar)
5. **Verify tenant isolation** in all 316 API routes — ensure no cross-tenant data access
6. **Test rate limiting** on login, registration, forgot-password, and public booking endpoints
7. **Review CORS configuration** in `next.config.mjs`
8. **Check CSP headers** for XSS prevention
9. **Audit the 7 previous security reports** (March 26 - April 13) for unresolved issues

---

## Previous Audit Reports

The following audit reports exist in the project root (could not read contents due to filesystem lock):
- `security-audit-2026-03-26.md`
- `security-audit-2026-03-29.md`
- `SECURITY-AUDIT-2026-03-30.md`
- `security-audit-2026-03-31.md`
- `SECURITY-AUDIT-2026-04-01.md`
- `SECURITY-AUDIT-2026-04-03.md`
- `security-audit-2026-04-06.md`
- `security-audit-2026-04-07.md`
- `SECURITY-AUDIT-2026-04-09.md`
- `SECURITY_AUDIT_2026-04-11.md`
- `SECURITY-AUDIT-2026-04-12.md`
- `audit-report-2026-04-13.md`
- `security-audit-report.docx` (April 5)

**Note:** The high frequency of audits suggests active security maintenance. Review continuity between reports for unresolved items.

---

*This report was generated under filesystem constraints. A full code-level audit should be conducted once the filesystem deadlock is resolved.*
