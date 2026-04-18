# Petra App — Security & Bug Audit Report

**Date:** April 9, 2026
**Scope:** Full codebase audit — API routes, auth, input validation, data leaks, common bugs

---

## Executive Summary

The Petra app demonstrates strong security fundamentals: consistent auth guards, IDOR prevention via session-derived businessId, parameterized SQL queries, rate limiting on sensitive endpoints, and proper password hashing (bcrypt 12 rounds). No critical authentication bypasses or SQL injection vulnerabilities were found.

**7 issues were found and fixed. 2 advisory items noted for future improvement.**

---

## Issues Found & Fixed

### 1. FIXED — Missing File Type Validation on Pet Documents Upload
**Severity:** Medium | **File:** `src/app/api/pets/[petId]/documents/route.ts`

The pet documents upload endpoint accepted any file type (including executables, scripts, etc.), while the equivalent customer documents endpoint properly validated against an allowlist.

**Fix:** Added `ALLOWED_FILE_EXTENSIONS` validation matching the customer documents pattern (pdf, jpg, jpeg, png, gif, webp, doc, docx, xls, xlsx, csv, txt, rtf, heic, heif).

### 2. FIXED — $transaction in Training Program Delete (PgBouncer Incompatibility)
**Severity:** Medium | **File:** `src/app/api/training-programs/[id]/route.ts`

Used `prisma.$transaction([...])` for deleting training program child records. Converted to sequential `await` calls for consistency with the established sequential pattern (e.g., customer delete) and PgBouncer safety.

### 3. FIXED — Missing Optional Chaining on pet.customer.phone
**Severity:** Low | **File:** `src/app/(dashboard)/dashboard/page.tsx` line 1558

Inside a conditional block, the inner JSX accessed `pet.customer.phone` without optional chaining. Fixed to `pet.customer?.phone ?? ""`.

### 4. FIXED — Missing Error Handling (try/catch) on 5 API Routes
**Severity:** Low | **Files:** owner/stats, owner/audit-logs, owner/consents, owner/customer-success, appointments/[id]/remind

These routes performed database operations without try/catch. Added proper error handling with logging and JSON error responses.

### 5. FIXED — Missing `export const dynamic = 'force-dynamic'` on 14 API Routes
**Severity:** Medium

Without this directive, Next.js 14 may statically optimize these routes, causing authenticated responses to be cached and served to wrong users. Added to all 14 affected routes.

---

## Advisory Items (Not Fixed — Require Design Decisions)

### A. Webhook Secret Exposed in URL Query Parameters
**Severity:** Medium-High | 4 Cardcom create-* routes

The CARDCOM_WEBHOOK_SECRET is passed in the IndicatorURL query parameter. This is a Cardcom API limitation. The indicator endpoint already uses timing-safe comparison. Consider adding HMAC-based request signing as an additional layer.

### B. Public Blob Storage for Uploaded Documents
**Severity:** Medium | 7 document/attachment upload routes

All uploaded files use `access: "public"` on Vercel Blob, relying on URL secrecy for access control. Consider signed URLs with expiration for sensitive documents.

---

## Areas Verified as Secure

- **Authentication:** All protected routes use auth guards consistently
- **IDOR Prevention:** businessId always derived from session, defense-in-depth in WHERE clauses
- **SQL Injection:** No unsafe raw SQL patterns found
- **Input Validation:** Comprehensive validation across routes
- **Rate Limiting:** Applied to all sensitive endpoints
- **Session Management:** SHA-256 hashed tokens, HttpOnly/SameSite cookies, proper expiration
- **Password Storage:** bcrypt 12 rounds, no hashes in API responses
- **Cron Auth:** Timing-safe comparison of CRON_SECRET
- **No Hardcoded Secrets** in source code
- **No platformRole in Client Responses**
- **TimelineEvent, Lead Stages, Customer Delete** — All follow documented patterns correctly
