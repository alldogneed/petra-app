---
name: petra-mcp-reference
description: "Petra MCP server reference moved out of CLAUDE.md — auth pattern, private-beta allowlist, scopes and role capping, token metadata, the tool list and module layout, write-tool conventions (idempotency_key, dry_run, safeField), rate limiting, paywall, OAuth auto-login, Claude Desktop config. Load BEFORE touching src/app/api/mcp, src/lib/mcp/*, src/lib/mcp-auth.ts, src/lib/mcp-oauth.ts, src/lib/mcp-allowlist.ts, McpConnection/McpAuditLog or the \"עוזרי AI\" settings tab. The two safety rules (middleware exact-path bypass, MCP_ENABLED kill switch) stay in CLAUDE.md."
---

# Petra — MCP server reference

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### Auth Pattern
```typescript
// Every MCP request: Bearer token → SHA-256 hash → McpConnection lookup → allowlist check → businessId + scopes
// src/lib/mcp-auth.ts — validateMcpToken(token) returns { businessId, connectionId, scopes } or null
```

### Private beta allowlist (`src/lib/mcp-allowlist.ts`)
MCP is visible/usable ONLY for: `alldogneed@gmail.com`, `or.rabinovich@gmail.com`, any `@petra.local` test user, plus `MCP_ALLOWED_EMAILS` env (comma-separated). `MCP_BETA_OPEN=true` opens to everyone.
- `getCurrentUser()` returns `mcpAllowed: boolean` → settings page hides the "עוזרי AI" tab + `/help/connect-ai` when false.
- `/api/mcp/connections*` return 404 for non-allowlisted sessions; `POST` additionally requires owner, or manager with the AI_ASSISTANT capability (or platform admin).
- `validateMcpToken` rejects tokens whose business has no allowlisted active member (`isMcpAllowedBusiness`).

### Scopes — enforced per tool
`DEFAULT_MCP_SCOPES` in `src/lib/mcp-auth.ts` (read:clients/appointments/stats/services/leads/orders/pets/boarding/training/tasks/analytics/payments + write:appointments/notes/reminders/clients/leads/orders/tasks/boarding/pets/services/payments/training + `admin:destructive`). Every tool handler starts with `if (!hasScope("…")) return denyScope(...)` (audited as `denied`). Legacy 6-scope connections are grandfathered to the full set via `effectiveScopes()`.
- **`admin:destructive` (`ADMIN_SCOPE`) — owner-only.** Gates irreversible paths on top of the write scope: `delete_task`, `delete_block`, `cancel_order` with `force:true` (paid order), `update_payment` status → canceled/refunded, `update_boarding_stay` status → canceled on a `checked_in` stay (dry_run answers "דורש admin:destructive — בעלים בלבד" instead of previewing). Admin checks run BEFORE `findIdempotentReplay`/any DB read (boarding: right after the stay lookup, since the status is needed). `block_time all_day:true` and normal unpaid `cancel_order` need no admin scope.
- **Role capping — `capScopesForRole(scopes, role, isPlatformAdmin)`.** Owner/platform-admin → unchanged; manager → minus `MANAGER_DENIED_SCOPES` (`read:analytics`, `write:payments`, `admin:destructive`); staff/other → read-only. Applied at mint time AND on every `validateMcpToken` (re-capped to the minter's CURRENT role — demoted manager's token shrinks; token dies when the minter leaves the business). Grandfathered tokens whose minter is now a manager lose admin too.
- **Per-member overrides apply to MCP too.** `validateMcpToken` returns `minterOverrides` (the minter's CURRENT `permissionOverrides`, re-read every request); `ToolCtx.hasPermission(PERM)` / `denyPermission(tool, PERM)` (audited `missing permission …`, Hebrew message naming the capability) = `hasTenantPermission(minterRole, PERM, minterOverrides)`; owner / platform admin / legacy token = always true. Checked right after the scope check, before replay/dry_run/DB: `block_time` + `delete_block` → AVAILABILITY_MANAGE, `send_reminder` → MESSAGES_SEND, `record_payment` + `update_payment` → PAYMENTS_WRITE, `cancel_order` + `update_order_status`→cancelled → ORDERS_CANCEL, `create_service` → PRICING_WRITE. A new write tool that maps to a `CRITICAL_CAPABILITIES` row must add the same check.
- **Token metadata:** `McpConnection` carries `createdByUserId` / `createdByRole` / `expiresAt` (180 days). Profiles `read | intake | calendar | boarding | full` via `MCP_PROFILES` (labels `MCP_PROFILE_LABELS`); `full` = everything the minter's role allows.

### 64 Tools + 2 prompts — `src/app/api/mcp/route.ts` + modules in `src/lib/mcp/`
Core (route.ts, 20): `list_clients` (cursor), `get_client`, `create_client`, `add_client_note`, `list_upcoming_appointments`, `list_services`, `create_appointment`, `update_appointment`, `cancel_appointment`, `get_business_stats`, `list_leads` (city/source/created, created_from/to, stage_name, offset, include_closed), `get_lead` (full card + whole journal: 50 call logs/stage changes with treatment, follow-up task history), `create_lead` (stage_name / next_follow_up / pet_* fields / deal_value / optional attribution: traffic_source, utm_source/medium/campaign, gclid, referrer, landing_page, first_page, page_type), `list_orders`, `get_order`, `create_order`, `list_tasks`, `list_pets`, `list_boarding_stays`, `list_training_programs`, `send_reminder`.
Intake (`tools-intake.ts`): `find_duplicate`, `list_lead_stages`, `create_task`, `update_task`, `update_lead`.
Boarding (`tools-boarding.ts`): `list_boarding_rooms`, `check_boarding_availability`, `quote_boarding_price`, `create_boarding_stay`, `get_boarding_daily_board`, `update_boarding_stay` (cancel of a checked_in stay → admin:destructive).
Briefing (`tools-briefing.ts`): `list_payments`, `get_analytics`, `get_morning_briefing`; prompts `morning_briefing`, `intake_from_screenshot`.
Pets (`tools-pets.ts`): `create_pet`, `update_pet`, `get_pet`, `record_vaccination`, `add_weight_entry`, `list_expiring_vaccinations`, `create_service`, `get_whatsapp_link` (wa.me deep link — server sends nothing).
Training (`tools-training.ts`): `get_training_program`, `create_training_program`, `update_training_program`, `log_training_session`, `update_training_session`, `add_training_goal`, `update_training_goal`.
Calendar (`tools-calendar.ts`): `find_free_slots` (booking slot engine — hours/blocks/bookings/GCal), `get_calendar` (day/week: appointments + group sessions + blocks + boarding check-ins/outs), `reschedule_appointment` (find_next_free), `block_time`, `list_blocks`, `delete_block` (admin:destructive), `list_group_sessions`; exports `findAppointmentConflicts()` used by create/update_appointment (refuse on overlap unless `force`, warn outside hours). create/update/cancel_appointment now sync Google Calendar like the UI routes.
Finance (`tools-finance.ts`): `record_payment`, `update_payment` (canceled/refunded → admin:destructive), `get_payment`, `cancel_order` (`force` → admin:destructive), `update_order_status`, `delete_task` (only hard delete exposed to AI; admin:destructive), `get_outstanding_balances`.
Shared helpers: `src/lib/mcp/helpers.ts` (`ToolCtx`, `safeField`, `heDate`, `israelStartOfToday`, `findIdempotentReplay`/`replayResult`, `dryRunResult`).
**Every write tool** accepts `idempotency_key` (replayed from McpAuditLog params — no schema) + `dry_run` (Hebrew preview, no write). Read-only tokens: `POST /api/mcp/connections {readOnly:true}` → `READ_ONLY_MCP_SCOPES` (UI default = read-only).

Output hygiene: all customer/lead-controlled strings go through `safeField()` (strips newlines/control chars — prompt-injection guard); dates via `heDate()` (Asia/Jerusalem). Audit log redacts PII params (`redactParams` in mcp-auth.ts).

### Rate limiting
- Per-token: 100 req/min
- Per-IP fail: 10 req/min (login protection)
Both use `rateLimitAsync()` from `src/lib/rate-limit.ts` (Upstash Redis-backed).

### Paywall
Settings tab "עוזרי AI" gated to `basic+`. The MCP endpoint itself doesn't enforce tier — token possession implies the user already passed the paywall when creating the connection.

### OAuth (auto-login)
User pastes `https://petra-app.com/api/mcp` into Claude (claude.ai/Desktop/Code) or Codex → client discovers OAuth → Petra login → consent (business + profile) → tokens. MCP Authorization spec 2025-06-18 (RFC 9728/8414/7591/7009/8707, OAuth 2.1).
- **Files:** `src/lib/mcp-oauth.ts` (all logic), `src/app/.well-known/{oauth-protected-resource,oauth-authorization-server}/[[...path]]` + `openid-configuration`, `src/app/api/oauth/{register,token,revoke,authorize}/route.ts`, consent page `src/app/oauth/authorize/` (page + `ConsentForm.tsx`). Models `OAuthClient`, `OAuthAuthCode` (+`connectionId`) + `McpConnection.{oauthClientId,refreshTokenHash,prevRefreshTokenHash,refreshRotatedAt,accessExpiresAt}`.
- **Grant = `McpConnection` row.** Access token is a normal `petra_mcp_…` token → `validateMcpToken()` (allowlist, role capping, revocation, audit, rate limit) applies unchanged; it also rejects expired `accessExpiresAt`. Settings shows these rows with badge "התחברות אוטומטית"; revoke = same DELETE (also nulls `refreshTokenHash`).
- **TTLs:** access 1h (`accessExpiresAt`), refresh `petra_mcpr_…` 90 days sliding (`expiresAt`) but **hard cap `OAUTH_GRANT_MAX_DAYS` = 365 from `createdAt`** (refresh refused after; sliding expiry capped), auth code 10 min single-use. Everything stored as SHA-256 only. Exchange + refresh re-verify the holder (active, owner / manager not explicitly denied AI_ASSISTANT (`canKeepAiGrant`) or admin, `ai_assistant` paywall w/ same exemptions, business allowlisted); `createdByRole` = re-verified role.
- **Public clients only:** DCR registers `token_endpoint_auth_method: "none"`, never a secret; PKCE **S256 only**; redirect_uri exact (loopback any-port per RFC 8252). Custom schemes must be reverse-DNS (contain ".") or a known client scheme (no `ms-msdt:`/`search-ms:`). **ANY `/oauth/authorize` param error → Hebrew error card, never a redirect** (open-redirect guard); only the user's "ביטול" sends `access_denied`.
- **Verified clients (`isVerifiedRedirect`):** https `claude.ai`/`claude.com`/`chatgpt.com`/`vscode.dev`/`insiders.vscode.dev` (exact host), loopback http, schemes `cursor`/`vscode`/`vscode-insiders`/`windsurf`. Consent shows the full target (`redirectTargetLabel`: origin with scheme / custom URI ≤80 chars); unverified → red "אפליקציה לא מאומתת" box + default profile `read` (verified → `full`). A platform admin with 2FA enabled but unverified session = non-admin on the consent screen.
- **Refresh rotation** via conditional `updateMany` (no `$transaction` — PgBouncer); presenting the previous refresh token (`prevRefreshTokenHash`) = reuse → connection revoked, except within 60s of rotation (`refreshRotatedAt`, benign client race → invalid_grant only). A replayed (already-exchanged) auth code revokes the connection it produced (`OAuthAuthCode.connectionId`).
- **Rate limits:** token 600/min per IP + 60/min per `client_id`; register 200/hour per IP + 2000/hour global (successful register also deletes >30-day-old never-connected clients, 200/run). Token endpoint rejects a mismatching `resource` with `invalid_target`.
- **Consent gates = `POST /api/mcp/connections` gates** (allowlist, owner / manager with AI_ASSISTANT (`canHoldAiGrant`) / platform-admin, `ai_assistant` paywall, `isMcpAllowedBusiness`, `capScopesForRole`, 10-connection limit — auto-revokes the same user's LRU OAuth connection). Client-requested `scope` is ignored; scopes come from the chosen profile.
- **`/api/mcp` 401:** `WWW-Authenticate: Bearer … resource_metadata=…/.well-known/oauth-protected-resource/api/mcp`. **Tokenless requests are NOT counted by the per-IP fail limiter** (claude.ai shares IPs; discovery probes are tokenless), **nor are known tokens** — a well-formed token whose hash matches an existing `McpConnection` (expired access token awaiting refresh, revoked, expired) gets 401 `invalid_token` directly (`isKnownMcpTokenHash`). Only unknown hashes count.
- **Login `next`:** `/login?next=/oauth/authorize?…` — validated by `safeNextPath()` in `src/lib/safe-redirect.ts` (relative, `/oauth/authorize` only); Google login carries it via the short-lived `petra_login_next` cookie.
- **Middleware:** `.well-known` OAuth paths, `/oauth/authorize`, `/api/oauth/{token,register,revoke}` are public; `/api/oauth/authorize` (consent POST) stays session-protected + same-Origin check.
- **Prod DDL:** `prisma/mcp_oauth.sql` (additive, idempotent) — run via `prisma db execute --url $DIRECT_URL` BEFORE deploying. Runbook: `docs/operations.md`.

### Claude Desktop config snippet
Preferred: **URL only** — add `https://petra-app.com/api/mcp` as a custom connector (Claude) / `claude mcp add --transport http petra <url>` / `codex mcp add petra --url <url>` + `codex mcp login petra`; OAuth does the rest. Manual static token (advanced, still supported, as is `/api/mcp/u/<token>`):
```json
{
  "petra": {
    "url": "https://petra-app.com/api/mcp",
    "headers": { "Authorization": "Bearer <token from הגדרות → עוזרי AI>" }
  }
}
```
