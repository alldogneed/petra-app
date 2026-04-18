# Security & Bug Audit Report — 2026-04-18

**Status:** STRUCTURAL ANALYSIS (filesystem deadlock prevents code-level review)  
**Auditor:** Automated scheduled task  
**Scope:** Petra App (Next.js SaaS application)  
**Previous Audit:** 2026-04-16 (also limited by filesystem deadlock)

---

## Executive Summary

This audit was again limited by the persistent `EDEADLK` filesystem deadlock that prevents reading any file contents. Despite this limitation, structural analysis has uncovered **one critical new finding** — customer documents stored in the publicly-accessible `public/` directory — along with continued flagging of known issues from previous audits.

**No files have been modified since the last audit** (April 16), confirming no code changes occurred in the interim.

---

## CRITICAL FINDINGS

### 1. Customer Documents Exposed in Public Directory (SEVERITY: CRITICAL — NEW)

Customer PDF files are stored in `public/uploads/customers/`, making them directly accessible to anyone via URL:

```
public/uploads/customers/caeda0cf-9f83-4b14-94d6-01c7e80a5a5e/18eaa846f05f54d7e863de46ee6d594d.pdf
public/uploads/customers/caeda0cf-9f83-4b14-94d6-01c7e80a5a5e/47d0602591906f5e0346b46cf9b00e3b.pdf
```

**Impact:** Any person who can guess or enumerate the UUID path can download customer documents without authentication. This is a **data breach vulnerability** under privacy regulations (GDPR, Israeli Privacy Protection Law).

**Recommended Actions:**
- **Immediate:** Move customer uploads OUT of the `public/` directory to a private storage location (e.g., Supabase Storage, S3, or a non-public directory served through an authenticated API route)
- **Short-term:** Implement an API route like `/api/customers/[id]/documents/[docId]/download` that validates authentication and tenant-level authorization before serving files
- **Audit:** Check if any other sensitive files exist in `public/uploads/` beyond the two found
- **Verify:** Determine if the document UUIDs use sufficient entropy (the filenames look like MD5 hashes — 128 bits, which is adequate if randomly generated, but UUIDs in the path may be sequential)

### 2. Filesystem Deadlock Persists (SEVERITY: CRITICAL — RECURRING)

All file read operations return `EDEADLK (Resource deadlock avoided)`. This affects:
- All source files, configuration files, and git repository objects
- Git HEAD ref is corrupted — `git log` returns "your current branch appears to be broken"
- Both `cat`, `cp`, `dd`, `mmap`, and Python `os.read()` with `O_NONBLOCK` all fail

**Impact:** Cannot perform code-level security review, cannot build/deploy from this environment, cannot run `npm audit`.

**Recommended Action:** This is a persistent environment issue. Restart the Cowork session environment, or remount the workspace folder. If the issue persists across sessions, investigate OS-level file locking.

### 3. SQLite Development Database in Repository (SEVERITY: HIGH)

File found: `prisma/dev.db` (1.4 MB)

A SQLite development database exists in the repository. It may contain:
- Test user credentials (even hashed passwords are sensitive)
- Seed data with real email addresses or phone numbers
- Schema structure that reveals business logic

**Recommended Actions:**
- Add `prisma/dev.db` to `.gitignore` if not already present
- Delete the file from the repository and git history (`git filter-branch` or `git filter-repo`)
- Use ephemeral databases for development instead

---

## HIGH-SEVERITY FINDINGS (Recurring from Previous Audits)

### 4. Debug/Test Routes in Production (SEVERITY: HIGH)

Three development-only routes remain in the codebase:

| Route | Size | Last Modified | Risk |
|-------|------|---------------|------|
| `api/seed/route.ts` | 1.1 KB | Mar 12 | Can insert test data, corrupt production DB |
| `api/test-notify/route.ts` | 1.3 KB | Apr 13 | Can trigger notifications, potential spam vector |
| `api/integrations/google/debug-sync/route.ts` | 5.0 KB | Mar 13 | Exposes internal sync state, potential data leak |

**Recommended Action:** Remove these routes or gate them behind `NODE_ENV !== 'production'` checks.

### 5. Multiple Environment Files (SEVERITY: HIGH — Recurring)

Eight `.env` files exist in the project root (unchanged from previous audit):

| File | Size |
|------|------|
| `.env` | 3.9 KB |
| `.env.local` | 4.1 KB |
| `.env.production` | 3.7 KB |
| `.env.staging` | 3.8 KB |
| `.env.vercel` | 3.0 KB |
| `.env.vercel-temp` | 2.8 KB |
| `.env.pulled` | 5.2 KB |
| `.env 2.example` | 4.2 KB |

**Recommended Action:** Cannot verify `.gitignore` coverage due to deadlock. Clean up `.env 2.example` and `.env.vercel-temp`.

### 6. Duplicate `node_modules` Directory (SEVERITY: MEDIUM)

A `node_modules 2/` directory exists (56 packages, last modified Apr 15). This is likely an accidental copy, wastes disk space (~1.7 GB total), and could cause dependency confusion.

**Recommended Action:** Delete `node_modules 2/`.

---

## MEDIUM-SEVERITY FINDINGS

### 7. Large API Attack Surface — 200+ Routes

The application has **approximately 200 API route files**. The largest routes (most complex, highest risk) are:

| Route | Size | Risk Area |
|-------|------|-----------|
| `customers/route.ts` | 20.7 KB | Data exposure, pagination bypass |
| `orders/route.ts` | 20.2 KB | Financial data |
| `cardcom/success-redirect/route.ts` | 18.0 KB | Payment flow manipulation |
| `analytics/export/route.ts` | 16.5 KB | Bulk data exfiltration |
| `book/[slug]/booking/route.ts` | 15.8 KB | Public booking abuse |
| `cron/charge-trials/route.ts` | 15.0 KB | Unauthorized billing charges |
| `cardcom/checkout-indicator/route.ts` | 14.8 KB | Forged payment notifications |
| `cardcom/trial-indicator/route.ts` | 14.6 KB | Forged trial activations |

### 8. `my-video/` Directory Contains Agent Configuration (SEVERITY: LOW)

The `my-video/` directory contains `.agent`, `.agents`, `.claude`, `.gemini`, `.opencode`, and `.superpowers` configuration directories. These appear to be AI agent configurations for a video project and are unrelated to the main application, but they contribute to repository clutter.

---

## Positive Security Architecture (Unchanged)

Based on file structure, the application maintains:
- Auth guards (`auth-guards.ts`, 11.4 KB)
- Rate limiting (in-memory + Redis-based)
- Permissions system with tests (`permissions.ts`, 11 KB)
- Cron authentication (`cron-auth.ts`, 1 KB)
- 2FA/TOTP support
- Audit logging
- Input validation
- CardCom security helpers
- Sentry error monitoring
- Encryption module (`encryption.ts`, 5.4 KB)

---

## Changes Since Last Audit (April 16)

**No source files have been modified since the last audit.** The only new file is the previous audit report itself.

---

## Priority Action Items

1. **🔴 CRITICAL:** Move customer documents out of `public/uploads/` — this is an active data breach vulnerability
2. **🔴 CRITICAL:** Resolve the filesystem deadlock to enable code-level auditing
3. **🟡 HIGH:** Fix the corrupted git repository
4. **🟡 HIGH:** Remove or protect debug/test routes (`seed`, `test-notify`, `debug-sync`)
5. **🟡 HIGH:** Delete `prisma/dev.db` from the repository
6. **🟠 MEDIUM:** Clean up `.env` file proliferation
7. **🟠 MEDIUM:** Delete `node_modules 2/` directory
8. **🔵 LOW:** Run `npm audit` once filesystem is accessible
9. **🔵 LOW:** Clean up `my-video/` directory from production repo

---

## Note on Audit Limitations

This is the **second consecutive audit** blocked by the filesystem deadlock. Without the ability to read file contents, the following critical checks **cannot be performed**:

- Code-level review of auth guards, permissions, and tenant isolation
- Verification of webhook signature validation in payment routes
- Review of encryption implementation (algorithm, key management, IV uniqueness)
- SQL injection pattern analysis in Prisma queries
- CORS and CSP header configuration review
- Token entropy analysis for public routes
- Rate limiting configuration verification
- Environment variable validation (are secrets strong enough?)

**Recommendation:** The filesystem deadlock must be resolved before the next audit cycle. Consider running a local audit using `npm audit`, ESLint security plugins, and/or Semgrep directly on the development machine.

---

*Generated: 2026-04-18 | Next scheduled audit: 2026-04-20*
