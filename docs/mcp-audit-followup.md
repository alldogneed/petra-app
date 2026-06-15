# MCP Audit — Follow-up Findings (out of scope for Fix Sprint A)

Items noticed during Fix Sprint A that were **not** part of the three assigned fixes.
Logged here per instruction ("אל תפתח scope") — not fixed in this sprint.

---

## F-1: `/api/mcp` is blocked by `middleware.ts` (BLOCKER — likely CRITICAL)

**Discovered:** 2026-06-11, while trying to run the local curl test for Fix 1 (rate limiting).

**Symptom:** A request to `POST /api/mcp` with a Bearer token (no `petra_session` cookie) returns:
```
HTTP 401
{"error":"Unauthorized"}
```
This body shape (`{ error: "Unauthorized" }`, no `message`) is the **middleware** response (`src/middleware.ts:116`), not the MCP route's (`src/app/api/mcp/route.ts`, which returns `{ error: "Unauthorized", message: "Invalid or missing MCP token" }`).

**Root cause:** `src/middleware.ts` requires a valid `petra_session` cookie for every `/api/*` path that is not on the public allowlist (`PUBLIC_PREFIX_PATHS` / `PUBLIC_EXACT_PATHS` / the auth subpath list). `/api/mcp` is on none of these lists, and the matcher (`"/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"`) does include it. So the middleware returns 401 before the request ever reaches the MCP route handler.

**Impact:**
- MCP clients (Claude Desktop, etc.) authenticate with an **`Authorization: Bearer petra_mcp_…` token**, not a session cookie. The middleware never sees a session cookie, so **every MCP request is rejected with 401 by middleware** — the entire MCP feature is non-functional as currently routed.
- This also **blocks the local verification of Fix 1**: the rate-limit code lives inside the route handler, which is unreachable until `/api/mcp` is allowed past middleware. The 110-request curl loop returns middleware 401s, not the route's 429s.

**Why not fixed here:** Fixing it means editing `src/middleware.ts` (a shared, security-sensitive file) to add `/api/mcp` to the public allowlist — outside the three assigned fixes, and a change that should be made deliberately with approval. The MCP route does its own Bearer-token auth + (now) rate limiting, so making it a public-prefix path is the intended pattern (same as `/api/webhooks/`), but the decision is the owner's.

**Suggested resolution (for owner approval):** Add `"/api/mcp"` to `PUBLIC_PREFIX_PATHS` in `src/middleware.ts` (it has self-contained Bearer auth + rate limiting + audit logging, exactly like the webhook routes already on that list). Then re-run the Fix 1 curl test.

**Status:** RESOLVED — fixed via `PUBLIC_EXACT_PATHS` (exact match, not prefix) in commit `ae8f530`, so `/api/mcp` is reachable while `/api/mcp/connections` stays session-protected. Verified with two live curls.

---

## F-2: Live test of `MCP_ENABLED=false` → 503 deferred (Fix Sprint A #2)

Live test of `MCP_ENABLED=false` → 503 deferred due to FS corruption; verify after reboot.

During Fix Sprint A the local Next dev server could not boot — repeated webpack
`getBaseWebpackConfig` failures parsing `node_modules/next/dist/compiled/*/package.json`
(`Unexpected end of JSON input`), a different non-truncated file each run (buffer,
constants-browserify, crypto-browserify, domain-browser). This is intermittent
filesystem read corruption on the machine, not a code or dependency issue (`npm install`
hit the same failure in `prisma generate`). The kill-switch guard itself is verified by
code review (`route.ts:281`, `=== "false"`) and a standalone logic check (only `"false"`
trips 503); the unset→active path was proven live earlier the same day. Only the live
503 / live `curl -I /dashboard` checks remain.

**Status:** OPEN — verify `MCP_ENABLED=false → 503` and `unset → 401` live after a reboot / FS recovery.

---

## F-3: No automated test coverage for MCP

Add test infrastructure for MCP — currently zero automated coverage. Critical for post-beta.

The project has **no test runner at all** (`npm test` → `Missing script: "test"`; no
vitest/jest configured). Every MCP guarantee (cross-tenant isolation, token validation,
rate limiting, kill switch, audit logging) is currently verified only by manual curl /
code review. Before scaling past closed beta, add a test harness and cover at minimum:
token validate/revoke, per-token + per-IP rate limiting, the `MCP_ENABLED` kill switch,
and cross-tenant isolation of each tool.

**Status:** OPEN — post-beta.
