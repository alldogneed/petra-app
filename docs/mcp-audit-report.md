# Petra MCP Pre-Production Audit Report

**Date:** 2026-06-11
**Branch:** feature/mcp-service-layer
**Commit:** 150266d86303efb522ef3e786a779b7d9e0ace75
**Auditor:** Claude Code

---

## Executive Summary

The Petra MCP server is **architecturally sound and the single most important security property — cross-tenant isolation — holds end to end.** `businessId` is derived exclusively from the bearer token on every request and threaded through a service layer where every Prisma query is scoped by `businessId`; no tool reads `businessId` from its input. Token generation uses a 256-bit CSPRNG with a `petra_mcp_` prefix, tokens are hashed before storage, raw tokens are never logged, and revocation works (revoked tokens fail validation immediately). The Cardcom/payments code is **completely untouched** by this branch (zero diff), and no new HIGH-severity npm vulnerability was introduced by the MCP work.

The gaps are operational and abuse-control, not isolation: there is **no rate limiting** on the MCP endpoint, **no global kill switch or bulk token revocation**, the `send_reminder` tool **bypasses the PRO+ tier gate and the per-business WhatsApp opt-out**, audit-log `params` store **client PII (notes) in plaintext with no redaction**, and tokens **never expire**. None of these are show-stoppers for a small, manually-onboarded closed beta, but several must be addressed before a public launch.

---

## Go/No-Go Recommendation

**GO-WITH-CONDITIONS** (closed beta only) — **NO-GO for public/self-serve launch** until the HIGH items below are resolved.

Conditions to satisfy before letting the first beta business connect:
1. ~~**H-1** — Add per-token/per-connection rate limiting on `POST/GET /api/mcp`.~~ **✅ DONE** — commit `d2e2e53` (Fix Sprint A #1).
2. **H-2** — `send_reminder` must enforce the `whatsapp_reminders` tier gate **and** `whatsappRemindersEnabled` toggle, exactly like `src/lib/reminder-service.ts` does. Today it fetches `tier` and never checks it. **— STILL OPEN (deferred by owner; defense-in-depth exists).**
3. **H-3** — Provide an emergency control: a global MCP kill switch (env/feature flag) **and** a "revoke all tokens for this business" action. **🟡 kill switch ✅ DONE** — commit `c758ccb` (Fix Sprint A #2); **bulk revoke STILL OPEN.**
4. **H-4** — Decide on audit-log PII: `add_client_note` and `create_appointment` write the full note text into `McpAuditLog.params`. Either redact or document/accept it explicitly. **— STILL OPEN (owner decision pending).**

The MEDIUM items (token expiry, tier gate on connection creation, RLS, append-only audit log) can be tracked as known issues during closed beta and fixed before public launch.

---

## Fix Sprint A — Resolution Log (2026-06-13)

| Item | Commit | Status |
|------|--------|--------|
| **F-1** — `/api/mcp` blocked by edge middleware (discovered mid-sprint; the feature was unreachable from outside) | `ae8f530` | ✅ RESOLVED — added to `PUBLIC_EXACT_PATHS` (exact match; `/api/mcp/connections` stays session-protected); 2 live curls |
| **H-1** — rate limiting | `d2e2e53` | ✅ RESOLVED |
| **H-3** — global kill switch | `c758ccb` | 🟡 PARTIAL (kill switch done; bulk-revoke open). Live 503 test deferred → `mcp-audit-followup.md` F-2 |
| **L-1** — misleading `bcrypt` schema comment | `58338f5` | ✅ RESOLVED |

Deliberately **deferred this sprint** (owner decision): H-2 (`send_reminder` tier/opt-out) and H-4 (audit-log PII redaction) — both have existing defense-in-depth and are not critical for a 3–5 business controlled beta. New follow-ups logged in `mcp-audit-followup.md`: **F-2** (verify live `MCP_ENABLED=false → 503` after reboot — local FS corruption blocked it) and **F-3** (no automated test coverage — add before post-beta). Branch stays `feature/mcp-service-layer`; not merged to `main`.

---

## Findings

### 🔴 CRITICAL (must fix before any user)

None. Cross-tenant isolation, token strength, and payment-code integrity all pass.

---

### 🟠 HIGH (fix before public launch — closed beta acceptable)

#### H-1: No rate limiting on the MCP endpoint
- **Location:** `src/app/api/mcp/route.ts:249` (`handleMcpRequest`), `src/lib/mcp-auth.ts:32` (`validateMcpToken`)
- **Issue:** Neither the route handler nor token validation applies any rate limit. There is no throttle on the number of tool calls per token, and no limit on failed-auth attempts. The codebase already has `rateLimitAsync()` (Upstash-backed) wired into auth and booking routes from the prior security audit, but MCP does not use it.
- **Risk:** A leaked or malicious token can drive unlimited tool calls (each `send_reminder` sends a billable WhatsApp message and each tool call writes audit rows and runs DB queries). Unbounded request volume is a cost/DoS vector. While the 256-bit token makes blind brute-force infeasible, there is still no backstop against abuse of a *valid* token.
- **Suggested fix:** Apply `rateLimitAsync` keyed by `connectionId` (e.g. N calls/min, stricter on `send_reminder`) inside `handleMcpRequest` after `validateMcpToken`; return 429 on breach and `auditLog(..., "denied")`.
- **Priority:** Before beta.
- **✅ RESOLVED [2026-06-13] — commit `d2e2e53` (Fix Sprint A #1).** Two layers via `rateLimitAsync`: `mcp:token` 100/min per connectionId, `mcp:auth-fail` 10/min per IP. Breach → 429 + `Retry-After` + `{error:'rate_limit_exceeded'}`; per-token breach also writes an audit entry with status `rate_limited`. Verified live (per-IP layer) + standalone limiter test (per-token threshold = 100).

#### H-2: `send_reminder` bypasses the PRO+ tier gate and the WhatsApp opt-out
- **Location:** `src/app/api/mcp/route.ts:191-242`
- **Issue:** The tool selects `biz.tier` (`route.ts:210`) but **never checks it**, and never checks `whatsappRemindersEnabled`. The canonical reminder pipeline (`src/lib/reminder-service.ts:30-33`, `:151-153`) gates on **both** `whatsappRemindersEnabled` and `hasFeatureWithOverrides(tier, "whatsapp_reminders", overrides)` (PRO+). MCP skips both.
- **Risk:** (a) Paywall bypass — a BASIC-tier business can send WhatsApp reminders (a PRO+ feature) through MCP. (b) Opt-out bypass — a business that explicitly disabled WhatsApp reminders will still send them via MCP, sending billable, potentially unwanted messages and undermining per-business consent.
- **Suggested fix:** Mirror the `reminder-service` guard: load `whatsappRemindersEnabled` + `featureOverrides`, reject with a clear Hebrew error (and `auditLog "denied"`) when the toggle is off or the tier lacks `whatsapp_reminders`.
- **Priority:** Before beta.

#### H-3: No global kill switch and no bulk token revocation
- **Location:** `src/app/api/mcp/route.ts` (no feature flag), `src/app/api/mcp/connections/[id]/route.ts:7` (per-id revoke only)
- **Issue:** There is no env/feature flag to disable MCP globally, and no single action to revoke all tokens for one business. In an incident, the only options are revoking tokens one-by-one or redeploying with the route removed.
- **Risk:** Slow incident response. If a business reports a compromised token or MCP needs to be shut off platform-wide, there is no fast, in-product lever.
- **Suggested fix:** (1) Add `MCP_ENABLED` env / `feature-flags` check at the top of `handleMcpRequest` returning 503 when off. (2) Add `DELETE /api/mcp/connections` (no id) that sets `revokedAt` for all of the business's active connections; optionally an owner-platform endpoint to revoke across all businesses.
- **Priority:** Before beta (at minimum the global kill switch).
- **🟡 PARTIALLY RESOLVED [2026-06-13] — commit `c758ccb` (Fix Sprint A #2).** Global kill switch done: fail-open `MCP_ENABLED` env check (503 when `=== "false"`) as the first step in `handleMcpRequest`, before auth/rate-limit; runbook in `docs/operations.md`. Live `503` test deferred (local FS corruption during the sprint — see `mcp-audit-followup.md` F-2; verify after reboot). **Still OPEN:** bulk "revoke all tokens for a business" in one action.

#### H-4: Client PII stored in audit-log params with no redaction
- **Location:** `src/lib/mcp-auth.ts:57-79` (`auditLog`, `params: params as any`), called from `route.ts:179` (`add_client_note` passes full `note`), `route.ts:158` (`create_appointment` passes `notes`)
- **Issue:** The full note/notes text — free-form content that can contain client names, phone numbers, medical or personal details — is written verbatim into `McpAuditLog.params` (JSON). Part 3.3 of the audit brief explicitly flags this. No redaction is applied.
- **Risk:** The audit log becomes a secondary, long-lived, unredacted store of customer PII. Combined with M-4 (no DB-level append-only / retention), this data persists indefinitely.
- **Suggested fix:** Redact or truncate free-text fields before persisting (e.g. store `note.length` / a hash, not the body), or consciously document this as accepted and ensure it is covered by the privacy policy and retention.
- **Priority:** Before beta — decide and document at minimum.

---

### 🟡 MEDIUM (next iteration)

#### M-1: Tokens never expire
- **Location:** `prisma/schema.prisma:2273` (`McpConnection` — no `expiresAt`), `src/lib/mcp-auth.ts:36` (validation filters only `revokedAt: null`)
- **Issue:** There is no expiry field; a token is valid forever until manually revoked.
- **Risk:** A long-lived secret that leaks (in a user's config file, a backup, a screen-share) stays exploitable indefinitely. Audit brief 1.5 asks to document this as at least a medium risk.
- **Suggested fix:** Add `expiresAt DateTime?`, surface an optional expiry in the create-connection UI, and add `expiresAt: { gt: now }` (or null) to the validation query. Consider a default (e.g. 1 year).

#### M-2: No tier gate on the connection-creation API
- **Location:** `src/app/api/mcp/connections/route.ts:35-83` (POST) — only `requireBusinessAuth` + a max-10 count check
- **Issue:** The UI gates the "עוזרי AI" tab behind a free-tier paywall (`settings/page.tsx:4509-4513`), but the API itself performs no tier check. A free-tier business can mint a working MCP token by calling `POST /api/mcp/connections` directly.
- **Risk:** Paywall bypass for token creation (the feature is sold as BASIC+). Lower impact than H-2 because the UI hides it, but the API is the real boundary.
- **Suggested fix:** Add `hasFeatureWithOverrides(tier, <mcp-feature>, overrides)` (or a tier >= basic check) to the POST handler; return 403 with the standard paywall error.

#### M-3: Row-Level Security disabled on all tables (defense-in-depth gap)
- **Location:** Postgres (`pg_class.relrowsecurity = false` for `Customer`, `Pet`, `Appointment`, `McpConnection`, `McpAuditLog`, `Business`, `Service`, `Order`, `Payment`, `TimelineEvent`, …)
- **Issue:** Isolation is enforced **entirely in the application/service layer**. There are no RLS policies. (This is consistent with Prisma connecting as the table owner, which bypasses RLS regardless.)
- **Risk:** Any future query that forgets `businessId` — in a new tool, a new service function, or a raw SQL path — has no database backstop and leaks cross-tenant. Today the service layer is disciplined and correct, but RLS would convert a future coding mistake from a breach into a denied query.
- **Suggested fix:** Longer-term, introduce RLS with a per-request `SET app.current_business_id` and a non-owner role, or formally accept app-layer-only isolation and compensate with a mandatory test that every service query is `businessId`-scoped. At minimum, document the decision.

#### M-4: Audit log is not append-only at the DB level, and integrity is tied to the connection row
- **Location:** `prisma/schema.prisma:2291` (`McpAuditLog`), relation `connection ... onDelete: Cascade`
- **Issue:** Append-only is only a convention (no API exposes UPDATE/DELETE on audit rows today — good), but there is no DB-level guard (no revoked UPDATE/DELETE grants, no trigger). Because of `onDelete: Cascade`, hard-deleting a `McpConnection` row (or cascading a `Business` delete) wipes its audit history. Revocation is soft (`revokedAt`) so it does not trigger this today, but the cascade is a latent integrity risk.
- **Risk:** A business owner who can ever trigger deletion of a connection/business row would also erase the corresponding audit trail. No tamper-evidence at the database tier.
- **Suggested fix:** Consider `onDelete: SetNull` (decouple audit rows from connection lifetime) or a separate retention table; optionally revoke UPDATE/DELETE on `McpAuditLog` from the app role.

#### M-5: No audit-log retention policy (unbounded growth)
- **Location:** `prisma/schema.prisma:2291` (`McpAuditLog`)
- **Issue:** Every tool call writes a row; nothing prunes them. Combined with H-4, this is unbounded PII accumulation.
- **Risk:** Table growth/cost over time and an ever-growing PII store.
- **Suggested fix:** Add a retention cron (e.g. delete/redact rows older than N months), consistent with the privacy policy.

---

### 🟢 LOW / INFO (consider for the future)

#### L-1: SHA-256 token hashing — acceptable here, but note the rationale
- **Location:** `src/lib/mcp-auth.ts:18-20` (`hashToken` uses `crypto.createHash("sha256")`); schema comment at `prisma/schema.prisma:2277` still says "bcrypt hash" (stale comment).
- **Note:** The audit brief (1.2) warns "SHA256 alone is not enough." That guidance targets **low-entropy passwords**. For a **256-bit CSPRNG token**, a single SHA-256 is the standard, correct approach (GitHub PATs do the same) — bcrypt/argon2 are unnecessary because there is nothing to brute-force. **Not a finding**, but fix the misleading `// bcrypt hash` comment in the schema.
- **✅ RESOLVED [2026-06-13] — commit `58338f5` (Fix Sprint A #3).** Comment corrected to SHA-256 (with rationale) in both `schema.prisma` and `schema.production.prisma`. The hashing algorithm was already correct; comment-only change.

#### L-2: `lastUsedAt` update is fire-and-forget (unawaited)
- **Location:** `src/lib/mcp-auth.ts:44-47`
- **Issue:** `prisma.mcpConnection.update(...).catch(() => {})` is not awaited. Per the project's own memory note ("always await async in Vercel"), unawaited promises can be killed by the serverless runtime, so `lastUsedAt` may intermittently not persist.
- **Risk:** Cosmetic/observability only — `lastUsedAt` may be stale. No security impact.
- **Suggested fix:** Await it, or accept the staleness and document it.

#### L-3: `any` casts in MCP code
- **Location:** `src/app/api/mcp/route.ts:93` (`(a as any).customer`, `(a as any).service`), `src/lib/mcp-auth.ts:70` (`params as any`)
- **Issue:** Minor type-safety erosion. The `a as any` masks that `listAppointments` returns a typed shape; the `params as any` is a Prisma JSON write convenience.
- **Suggested fix:** Type the appointment select result and use `Prisma.InputJsonValue` for params. Low priority.

#### L-4: Dead branch in `send_reminder` phone normalization
- **Location:** `src/app/api/mcp/route.ts:224`
- **Issue:** `phone.startsWith("972") ? phone : phone` — both branches return `phone`; the final ternary arm is a no-op. Harmless but sloppy; numbers already in `+972` form without a leading `0` are passed through unchanged (works), but the intent is unclear.
- **Suggested fix:** Simplify to a single, clearly-correct normalization helper (reuse `toWhatsAppPhone` from utils).

#### L-5: Stateless transport closes server via `setTimeout(0)`
- **Location:** `src/app/api/mcp/route.ts:272-275`
- **Issue:** `setTimeout(() => server.close()..., 0)` after returning the response is fire-and-forget cleanup. On Vercel serverless this generally runs, but is not guaranteed.
- **Risk:** Negligible (stateless, fresh instance per request). Informational.

---

## Test Results

> Static/code-level verification was performed for all tests. The live Claude-Desktop-in-staging portions of Part 10 (Tests 1, 3, 5 as interactive client sessions) require a running staging deployment with two real connected clients and could not be executed autonomously in this audit; they are marked **NEEDS MANUAL RUN** with the code-level conclusion noted. The critical cross-tenant test (Test 2) is **provable from code** and is reported as such.

### Test 1: Happy Path
- **Status:** NEEDS MANUAL RUN (code-verified plausible)
- **Details:** All 6 tools are correctly wired to service-layer functions and each writes an audit entry on both success and error (`route.ts:59,67,88,98,112,123,158,162,180,183,234,238`). Recommend connecting Claude Desktop with a token and confirming each tool returns and audit rows appear.

### Test 2: Cross-Tenant Isolation (CRITICAL)
- **Status:** PASS (code-level)
- **Details:** `buildServer(auth.businessId, auth.connectionId)` (`route.ts:261`) binds `businessId` from the validated token (`mcp-auth.ts:49-53`). Every tool passes that `businessId` into the service layer; no tool accepts or reads a `businessId`/business identifier from its input schema. A very-thorough read of all `src/services/*.ts` confirmed every `findMany/findFirst/findUnique/update/delete/count/aggregate` is scoped by `businessId` (or by `OR: [{ customer: { businessId } }, { businessId }]` for pets), all `$queryRaw` is parameterized with `${businessId}`, and write tools (`create_appointment`, `add_client_note`) validate that referenced `customerId`/`serviceId`/`petId` belong to the same business before writing. An input attempting to pass another business's id is therefore ignored (the field does not exist) and cannot widen the query. **Recommend a final live confirmation** with token A (business "Alice") vs token B (business "Bob") showing zero overlap, but the guarantee is structural.

### Test 3: Token Revocation
- **Status:** PASS (code-level) / NEEDS MANUAL RUN for live confirmation
- **Details:** `validateMcpToken` filters `revokedAt: null` (`mcp-auth.ts:36-41`); a revoked token returns `null` → 401 (`route.ts:254-259`). `DELETE /api/mcp/connections/[id]` sets `revokedAt` (`[id]/route.ts:28-31`). One gap vs the brief: a **rejected request returns 401 before a connection context exists, so no `auditLog` entry is written for a denied/revoked token** — failed auth attempts are **not** audited (see also H-1). Recommend adding a denied-auth audit path.

### Test 4: Malformed Input
- **Status:** PASS (code-level)
- **Details:** Every tool input is validated by a Zod schema (`route.ts:50-53,78,134-140,173-175,196`). Invalid input is rejected by the MCP SDK before the handler runs; handler errors return a Hebrew `errorResult` (`route.ts:34-36`) with no stack trace, table names, or internal IDs. Service errors surface only `ServiceError.message` (controlled Hebrew strings) or a generic fallback. No information leakage observed.

### Test 5: Performance
- **Status:** NEEDS MANUAL RUN
- **Details:** Not measurable without a live dataset. Note: `get_business_stats` (`getBusinessOverview`) and `list_clients` (with `name_asc` raw SQL + count) are the heaviest. Indexes on `McpConnection.tokenHash`, `McpAuditLog.connectionId`, `McpAuditLog.createdAt` are present (verified), so auth and audit writes are indexed. Recommend timing each tool against a realistic business; flag anything > 2s.

### Test 6: Result Size
- **Status:** PASS (code-level)
- **Details:** `list_clients` is double-bounded: the Zod schema caps `limit` at 50 (`route.ts:52`), and `listCustomers` clamps `take` to `Math.min(Math.max(take, 1), 100)` (`clients.ts:170`). `list_upcoming_appointments` is bounded by a max 90-day window. No tool can return thousands of unbounded rows.

---

## Part 8 — Cardcom / Payments Integrity (CRITICAL gate)

**PASS — zero changes.** `git diff main..feature/mcp-service-layer` and the working-tree diff vs `main`, both filtered to `*cardcom* *payment* *billing* *subscription*`, returned **no changes**. The MCP branch did not touch any payment, billing, Cardcom, or subscription code. No CRITICAL, audit continues.

## Part 9 — Dependencies

- **New dependency on the branch:** exactly one — `@modelcontextprotocol/sdk@^1.29.0` (official Anthropic SDK, trusted source). No other dependency was added (`git diff main..feature/mcp-service-layer -- package.json`).
- **`npm audit` (prod):** 13 vulnerabilities (8 moderate, 5 high). **All are pre-existing and unrelated to MCP:** `xlsx` (HIGH, prototype pollution + ReDoS, no fix available) and `uuid` pulled transitively via `svix` → `resend` and `@sentry/webpack-plugin`. **None originate from `@modelcontextprotocol/sdk`.** No new HIGH+ vulnerability was introduced by the MCP work. (The `xlsx`/`uuid` findings should be tracked separately as part of general dependency hygiene.)

---

## Sign-off Checklist

Before Or approves production:

- [ ] All CRITICAL fixed — **N/A (zero CRITICAL)**
- [ ] All HIGH handled or documented as known — **H-1 rate limiting, H-2 send_reminder tier/opt-out, H-3 kill switch + bulk revoke, H-4 audit-log PII**
- [x] Cross-tenant test PASS — **PASS (code-level; recommend one live A/B confirmation)**
- [x] Revocation test PASS — **PASS (note: denied attempts are not audited — see Test 3 / H-1)**
- [ ] Performance acceptable (every tool < 2s) — **NEEDS MANUAL RUN against a real dataset**
- [x] Zero changes to Cardcom code — **PASS (zero diff)**
- [x] No new HIGH+ npm vulnerabilities from MCP — **PASS (only new dep is the official MCP SDK; existing HIGHs are xlsx/uuid, pre-existing)**
- [ ] Audit log complete and tamper-resistant — **Writes on success/error: yes. Gaps: denied-auth not audited (Test 3); not DB-level append-only and `onDelete: Cascade` (M-4); PII unredacted (H-4)**
- [ ] Kill switch / bulk token revocation in an emergency — **MISSING (H-3)**

---

## Auditor Notes

- **The core security model is correct.** The "service layer owns `businessId`, tools never accept it" design is exactly right and is the reason cross-tenant isolation holds. The service layer was audited function-by-function and is disciplined: write tools validate ownership of every referenced foreign key before writing.
- **The real pre-production work is operational, not architectural:** rate limiting, a kill switch, tier/opt-out enforcement on `send_reminder`, and an audit-log PII decision. These are bounded, well-understood fixes.
- **One nuance worth not "fixing" wrongly:** SHA-256 for the token hash is *correct* here (high-entropy secret) — do not "upgrade" to bcrypt/argon2; just fix the stale `// bcrypt hash` schema comment.
- **Denied/failed authentication is currently invisible** — neither rate-limited nor audited. Adding a denied-auth audit path closes both the Test 3 gap and part of H-1.
- **RLS-off** means there is no database safety net. The current code doesn't need one because it's correct, but every future tool/query is one forgotten `businessId` away from a leak. A mandatory "every service query is businessId-scoped" test would be a cheap, durable guard.
- **No code was changed during this audit**, per the brief. All findings are reported for your review and prioritization.
