# Petra App — Security & Bug Audit Report
**Date:** 2026-03-26
**Scope:** Comprehensive review of ~60+ API routes, auth guards, input validation, data exposure, and logic bugs.

---

## Summary

The Petra codebase demonstrates strong security fundamentals — consistent use of `requireBusinessAuth()`, proper `businessId` scoping from sessions (not request body), rate limiting on write operations, and role-based permission checks. No SQL injection or XSS vulnerabilities were found.

However, several issues were identified and **4 fixes were applied** in this audit.

---

## Issues Found & Fixed

### 1. CRITICAL — Mass Assignment in Pending Approvals
**File:** `src/app/api/pending-approvals/[id]/route.ts`
**Problem:** The `EDIT_PRICING` and `EDIT_SETTINGS` approval actions cast the entire JSON payload directly to Prisma `update()` calls without field allowlisting. An attacker with approval-creation privileges could inject fields like `tier`, `status`, or `ownerId` into the payload JSON, and those would be applied verbatim on approval.
**Fix applied:** Added explicit field allowlists for both `EDIT_PRICING` (name, basePrice, description, duration, isActive, maxParticipants, serviceId) and `EDIT_SETTINGS` (name, phone, email, address, city, description, logoUrl, timezone, currency, businessType, bookingEnabled, bookingNotes, cancellationPolicy). Any extra fields in the payload are now silently ignored.

### 2. HIGH — Missing File Type Validation in Document Upload
**File:** `src/app/api/customers/[id]/documents/route.ts`
**Problem:** Any file type could be uploaded — including `.js`, `.html`, `.exe`, `.svg` (XSS vector). Files are stored publicly on Vercel Blob. Additionally, the `category` field was not validated against the defined categories.
**Fix applied:** Added an extension allowlist (pdf, jpg, jpeg, png, gif, webp, doc, docx, xls, xlsx, csv, txt, rtf, heic, heif) and category validation against the defined `DOCUMENT_CATEGORIES` array.

### 3. HIGH — Missing Email, Phone & Name Validation in Leads
**File:** `src/app/api/leads/route.ts`
**Problem:** The leads POST route accepted `email`, `phone`, and `name` without validation, even though the codebase has `validateEmail()`, `validateIsraeliPhone()`, and `sanitizeName()` utilities. Invalid data could break downstream email/SMS sending and Google Contacts sync. The `notes` field had no length limit, allowing multi-megabyte strings.
**Fix applied:** Added `sanitizeName()` for name (min 2 chars), `validateEmail()` for email, `validateIsraeliPhone()` for phone, and a 5000-char limit on notes.

### 4. MEDIUM — Missing Payment Amount Bounds
**File:** `src/app/api/payments/route.ts`
**Problem:** Payment amount was only checked for `> 0` but had no upper bound or decimal precision check. An attacker could create payments with extreme values (e.g., 99999999999999.99) or infinite decimal places, causing financial reporting inconsistencies.
**Fix applied:** Added max amount of ₪1,000,000, `Number.isFinite()` check, and 2-decimal-place precision validation.

---

## Issues Noted (Not Fixed — Lower Priority)

### 5. MEDIUM — Pagination Without User-Controlled Limits
**Files:** `orders/route.ts` (take: 500), `payments/route.ts` (take: 200), `leads/route.ts` (take: 200), `tasks/route.ts` (take: 200)
**Problem:** Static `take` values without cursor-based pagination. While this works for small businesses, it could cause performance issues as data grows.
**Recommendation:** Add `page`/`limit` query params with a max cap (e.g., 100).

### 6. LOW — platformRole in Platform Admin API Responses
**Files:** `owner/users/route.ts`, `owner/tenants/[tenantId]/members/route.ts`
**Problem:** These routes return `platformRole` in responses. Per CLAUDE.md rule #11, platformRole should be server-only.
**Assessment:** Since these routes are protected by `requirePlatformPermission()` and only accessible to platform admins who legitimately need to see roles, this is acceptable. Flagged for awareness.

### 7. LOW — Dual Session Cookie Functions
**File:** `src/lib/session.ts`
**Problem:** Both `buildSessionCookie()` and `setSessionCookie()` exist. The `buildSessionCookie()` function doesn't properly handle remember-me duration. Currently only `setSessionCookie()` is used in auth flows.
**Recommendation:** Remove or deprecate `buildSessionCookie()` to prevent future confusion.

---

## Areas Verified as Secure

- **Auth guards:** All business-scoped routes use `requireBusinessAuth()` correctly
- **IDOR protection:** All queries filter by session-derived `businessId`
- **SQL injection:** No `$queryRawUnsafe` or `$executeRawUnsafe` usage found
- **XSS:** Email templates use `escapeHtml()`, no `dangerouslySetInnerHTML` found
- **Rate limiting:** All write operations and auth routes are rate-limited
- **Cron security:** Cron routes use proper secret token authentication
- **Session security:** Crypto-random tokens, httpOnly cookies, proper expiry
- **Tier enforcement:** Feature limits enforced before resource creation
- **Role-based access:** Finance, PII, and admin operations properly gated
- **DEMO_BUSINESS_ID:** Only used in public booking routes as intended
