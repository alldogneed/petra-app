# Petra App — Security & Bug Audit Report

**Date:** 2026-04-01
**Scope:** Comprehensive review of all API routes, auth patterns, input validation, business logic, and convention compliance.

---

## Summary

Audited ~150+ API route files across the Petra app. Found **10 IDOR defense-in-depth gaps** (fixed), **1 null-safety crash bug** (fixed), and several lower-severity input validation findings (noted for future work).

**Overall posture: Good.** All routes have authentication guards, no SQL injection or XSS vulnerabilities, secrets are properly managed, and CLAUDE.md conventions are followed.

---

## Critical Fixes Applied

### 1. IDOR Defense-in-Depth — businessId Added to Mutation WHERE Clauses

**Problem:** Multiple routes correctly verified resource ownership via `findFirst` with `businessId`, but then performed `update`/`delete` operations using only the resource `id` in the WHERE clause. While the findFirst check prevents unauthorized access, adding `businessId` to the mutation WHERE clause provides defense-in-depth against race conditions or logic errors.

**Files Fixed:**

| File | Operation | Fix |
|------|-----------|-----|
| `api/tasks/[id]/route.ts` | PATCH update | Added `businessId` to `where` |
| `api/contracts/requests/[id]/route.ts` | DELETE | Added `businessId` to `where` |
| `api/availability/breaks/[id]/route.ts` | DELETE | Added `businessId` to `where` |
| `api/boarding/care-log/[id]/route.ts` | DELETE | Added `businessId` to `where` |
| `api/pricing/[id]/route.ts` | PATCH + DELETE | Added `businessId` to `where` |
| `api/pricing/[id]/items/[itemId]/route.ts` | PATCH + DELETE | Added `businessId` to `where` |
| `api/admin/blocks/[id]/route.ts` | DELETE + PATCH | Added `businessId` to `where` |
| `api/boarding/[id]/route.ts` | PATCH + DELETE | Added `businessId` to `where` |

**Note:** Routes for `trainingGoal`, `trainingHomework`, `trainingProgramSession`, `dogMedication`, and `pets/medications` verify ownership through parent relations (e.g., `program.businessId`, `pet.customer.businessId`). These models don't have a direct `businessId` field, so the current `findFirst` verification pattern is correct and cannot be further strengthened at the Prisma WHERE level.

### 2. Null Safety — Pet.customerId Crash in Dashboard

**Problem:** `pet.customer.name` and `pet.customer.phone` accessed without optional chaining on the dashboard birthday section. Since `Pet.customerId` is nullable (per schema), this crashes when a pet has no associated customer (e.g., service dogs).

**File Fixed:** `src/app/(dashboard)/dashboard/page.tsx` (lines 1518, 1524)
- `pet.customer.name` → `pet.customer?.name ?? ""`
- `pet.customer.phone` → `pet.customer?.phone`

---

## Positive Findings (No Issues)

| Category | Status |
|----------|--------|
| **Authentication** | All non-public routes use `requireBusinessAuth`, `requirePlatformRole`, or `requirePlatformPermission` |
| **IDOR (businessId from session)** | All authenticated routes derive `businessId` from session, never from request body/params |
| **SQL Injection** | No raw SQL queries (`$queryRaw`/`$executeRaw`) found — all queries use Prisma parameterized ORM |
| **XSS** | No `dangerouslySetInnerHTML` with user input; only used for JSON-LD structured data |
| **Rate Limiting** | Properly implemented on login, register, forgot-password, 2FA verify |
| **Secrets Exposure** | No API keys or password hashes in API responses; `.env` files properly gitignored |
| **File Uploads** | Type and size validation on document (10MB) and logo (5MB) endpoints |
| **Password Security** | Strong requirements (12+ chars, mixed case, digit) with bcrypt hashing |
| **2FA Security** | Zod-validated, rate-limited, with proper enrollment flow |
| **Interactive Transactions** | Not used for customer delete (Supabase PgBouncer compatible) |
| **Lead Stages** | Queried from DB, not hardcoded |
| **platformRole** | Not exposed to client; only `isAdmin: boolean` returned |
| **Service Dog Placements** | Only ACTIVE and TERMINATED statuses used |
| **Leads Kanban Sort/Badge** | Overdue condition identical in both sort and badge rendering |
| **TimelineEvent** | No `title` field used |

---

## Lower Severity — Noted for Future Work

### Unvalidated Date Inputs (Medium)
~35+ routes construct `new Date()` from user input without validating the result isn't `Invalid Date`. Recommendation: add a `validateDate()` helper and use it across all date-accepting routes.

### Missing Type Validation on Settings Fields (Low-Medium)
`/api/settings/route.ts` accepts numeric fields (`boardingMinNights`, `vatRate`, etc.) without type checking. Recommendation: add Zod schema validation.

### Missing String Length Limits (Low)
Some text fields (`cancellationPolicy`, `bookingWelcomeText`) lack max-length validation before storage.

---

## Remaining IDOR Items — Cannot Fix at Prisma Level

These routes verify ownership through parent relations and use `where: { id }` for mutations. Since the child models don't have a direct `businessId` column, adding it to the WHERE is not possible with Prisma's `update`/`delete`. The `findFirst` ownership check is the correct approach:

- `api/medications/[id]/route.ts` — ownership via `pet.customer.businessId`
- `api/pets/[petId]/medications/[medId]/route.ts` — ownership via pet relation
- `api/training-programs/[id]/sessions/[sessionId]/route.ts` — ownership via program relation
- `api/training-programs/[id]/goals/route.ts` — ownership via program relation
- `api/training-programs/[id]/homework/route.ts` — ownership via program relation
- `api/service-dogs/[id]/insurance/route.ts` — ownership via service dog relation
