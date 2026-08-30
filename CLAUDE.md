# Petra App — AI Agent Reference

**Petra** is a Hebrew/RTL B2B SaaS for Israeli pet-service businesses (dog trainers, boarding, groomers).
Stack: Next.js 14, TypeScript, Prisma/PostgreSQL, React Query, Tailwind, sonner toasts.

Full reference docs in `docs/`:
- `docs/architecture.md` — tech stack, folder structure, DB schema, env vars
- `docs/features.md` — feature map, tier enforcement, cron jobs
- `docs/conventions.md` — code patterns, how to run, known issues
- `docs/deployment.md` — branches, Vercel, Supabase, WhatsApp status
- `docs/service-layer.md` — `src/services/` architecture, ServiceError codes, what stays in routes

---

## Critical Rules — Never Break

### 1. Node PATH (every command)
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate
```

### 2. Dev server (Hebrew path — npm run dev doesn't work)
```bash
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'; node node_modules/.bin/next dev) > /tmp/petra-dev.log 2>&1 &
```

### 3. PostCSS version — NEVER update
`"postcss": "8.4.47"` — 8.5.x breaks Next.js 14.2.x.

### 4. Production schema sync — after EVERY schema change
```bash
cp prisma/schema.prisma prisma/schema.production.prisma
git add prisma/schema.production.prisma
```
Vercel uses `schema.production.prisma`. Stale = deployment failure.

### 5. Auth pattern — ALL protected API routes
```typescript
const authResult = await requireBusinessAuth(request);
if (isGuardError(authResult)) return authResult;
const { businessId } = authResult;
// NEVER use DEMO_BUSINESS_ID in protected routes
```

### 6. DEMO_BUSINESS_ID — only in
- Public booking routes (`/api/booking/*`)
- Seed scripts
- Platform admin routes that need it explicitly

### 7. Pet.customerId is nullable
```typescript
pet.customer?.name ?? ""   // always optional chain
```

### 8. TimelineEvent — NO title field
```typescript
{ type: "CUSTOMER_CREATED", description: "...", businessId, customerId }
// relation: 'timelineEvents' (not 'timeline')
```

### 9. Lead stages are UUIDs from DB
```typescript
// NOT hardcoded "new"/"contacted" — always query LeadStage table
const stages = await prisma.leadStage.findMany({ where: { businessId } });
```

### 10. IDOR security
All authenticated API routes derive `businessId` from session — never from request body/params.

### 11. `platformRole` is server-only — use `isAdmin` client-side
`getCurrentUser()` returns `isAdmin: boolean` (not `platformRole`). The raw `platformRole` string is only available in server-side session objects (`auth-guards.ts`, `session.ts`). Never add `platformRole` back to client-facing API responses.

### 12. Service dog phases — single source of truth
`SERVICE_DOG_PHASES` in `src/lib/service-dogs.ts` drives ALL phase UI and API validation.
`VALID_PHASES` in `/api/service-dogs/[id]/phase/route.ts` is derived from it — never hardcode phase strings elsewhere.
Current order: SELECTION → RAISING → PUPPY → IN_TRAINING → ADVANCED_TRAINING → CERTIFIED → RETIRED → DECERTIFIED

### 13. Recipient stages — REJECTED = archive
`DEFAULT_STAGES` in `/api/service-recipient-stages/route.ts` is upserted (name + color) on every GET.
`REJECTED` is the only "archive" stage — hidden by default in kanban + table; toggled by "ארכיון" button.
`activeStages = stages.filter(s => showArchive || s.key !== "REJECTED")` pattern in recipients page.
AddRecipientModal receives stages filtered without REJECTED.

### 14. Placement statuses — only 2
`SERVICE_DOG_PLACEMENT_STATUSES` = `ACTIVE` (פעיל) + `TERMINATED` (הסתיים).
No PENDING / TRIAL / SUSPENDED / COMPLETED. New placements default to `ACTIVE`.
`activePlacement` filter: `p.status === "ACTIVE"` (not `|| "TRIAL"`).

### 15. Service dog types — includes PTSD
`SERVICE_DOG_TYPES` in `src/lib/service-dogs.ts`: MOBILITY, PSYCHIATRIC, PTSD, GUIDE, AUTISM, ALERT, OTHER.

### 16. `shadcn init` destroys utils.ts
Restore: `DEMO_BUSINESS_ID`, `formatCurrency`, `formatDate`, `formatTime`, `getStatusColor`, `getStatusLabel`, `toWhatsAppPhone`, `getTimelineIcon`

### 17. Customer DELETE — sequential, NO $transaction
Supabase PgBouncer (transaction pooling) is incompatible with Prisma interactive transactions. Customer delete runs all cleanup sequentially:
```
InvoiceDocument.updateMany(originalInvoiceId→null) → InvoiceDocument.deleteMany → InvoiceJob.deleteMany
→ Payment.deleteMany → Appointment.deleteMany → OrderLine.deleteMany → Order.deleteMany
→ BoardingStay.updateMany(customerId→null) → Lead.updateMany(customerId→null)
→ TrainingProgram.updateMany(customerId→null) → Booking.deleteMany
→ ScheduledMessage/ContractRequest/IntakeForm/TimelineEvent/ServiceDogRecipient/TrainingGroupParticipant.deleteMany
→ Task.deleteMany(relatedEntityType="CUSTOMER") → Pet.deleteMany → Customer.delete
```
`Booking.customerId` is non-nullable → must deleteMany, not updateMany(null).
`Task` has no `customerId` FK — uses `relatedEntityType`/`relatedEntityId` strings.
`InvoiceDocument` has self-referencing credit note → must null `originalInvoiceId` before deleteMany.

### 18. Leads Kanban — sort vs badge must match
`sortLeadsByPriority()` at bottom of `leads/page.tsx`: priority 0 = overdue.
Overdue condition: `followUpDate && followUpDate < todayStart` (no `followUpStatus` check).
Card badge uses identical condition — never add extra conditions to one without updating the other.

### 19. Lead notifications — PRO+ only
`lead_notifications` feature flag in `src/lib/feature-flags.ts`: true for `pro` + `service_dog` only.
When a new lead is created (manual or via webhook), `POST /api/leads` fires-and-forgets a WhatsApp to the business owner's phone.
Uses approved template `petra_biz_lead_alert` (WABA `25882288788086856`) with fallback to free-form.
Body params order: `[lead.name, lead.phone || "לא צוין", lead.requestedService || "לא צוין"]`.
For non-PRO businesses the feature is silently skipped (no UI shown in leads page — handled by TierGate elsewhere).

### 20. Analytics page is named "דוחות"
Sidebar entry and page title are "דוחות" (not "אנליטיקס"). Route remains `/analytics`.
`src/components/layout/sidebar.tsx` line: `{ name: "דוחות", href: "/analytics", ... }`

### 21. Sidebar nav is grouped by eyebrows
`navEntries` in `src/components/layout/sidebar.tsx` is interleaved with `{ eyebrow: "..." }` markers. Three sections: **תפריט ראשי** (dashboard/customers/leads/tasks/scheduler/calendar), **מודולים** (boarding/pricing/service-dogs/training/pets), **ניהול** (analytics/business-admin/settings). When adding a new nav item, place it in the correct group; eyebrows render as uppercase white/40 labels above each group.

### 22. Marketing stats must stay aligned
Login hero (`src/app/login/page.tsx`) and `AnimatedStats.tsx` both display the same three metrics: **130 / 5,000+ / 98%**. Update both files together if any number changes.

### 23. Subscription expiry banner only for paid tiers
Dashboard renewal banner uses `!isFree && subscriptionActive && subscriptionDaysLeft <= 14`. Never show "renew" warning to a user on free tier even if they have a stale `subscriptionEndsAt` from a former paid plan.

### 24. Dev webpack uses memory cache (Hebrew path)
`next.config.mjs` sets `config.cache = { type: "memory" }` in dev. The default PackFileCacheStrategy fails snapshot resolve on the Hebrew project path (`פיתוח`) and stalls compilation. Don't remove. Production build uses default cache and is unaffected.

### 25. Search modal must close on mobile
`src/components/search/global-search.tsx` has a permanent X button in the header (always visible, not just when `query` is filled) **and** the backdrop+dialog wrapper is a single layer so taps outside the modal close it. Without these two together, mobile users get stuck — no ESC key, X is hidden, backdrop click eaten by the dialog wrapper.

---

## MCP Server

### Architecture
```
Supabase ← src/services/ ← { API routes | MCP tools }
```
Both UI routes and MCP tools call the same service functions. No duplicated business logic.

### Auth Pattern
```typescript
// Every MCP request: Bearer token → SHA-256 hash → McpConnection lookup → allowlist check → businessId + scopes
// src/lib/mcp-auth.ts — validateMcpToken(token) returns { businessId, connectionId, scopes } or null
```

### Private beta allowlist (`src/lib/mcp-allowlist.ts`)
MCP is visible/usable ONLY for: `alldogneed@gmail.com`, `or.rabinovich@gmail.com`, any `@petra.local` test user, plus `MCP_ALLOWED_EMAILS` env (comma-separated). `MCP_BETA_OPEN=true` opens to everyone.
- `getCurrentUser()` returns `mcpAllowed: boolean` → settings page hides the "עוזרי AI" tab + `/help/connect-ai` when false.
- `/api/mcp/connections*` return 404 for non-allowlisted sessions; `POST` additionally requires owner/manager (or platform admin).
- `validateMcpToken` rejects tokens whose business has no allowlisted active member (`isMcpAllowedBusiness`).

### Scopes — enforced per tool
`DEFAULT_MCP_SCOPES` in `src/lib/mcp-auth.ts` (read:clients/appointments/stats/services/leads/orders/pets/boarding/training/tasks/analytics/payments + write:appointments/notes/reminders/clients/leads/orders/tasks/boarding/pets/services/payments/training + `admin:destructive`). Every tool handler starts with `if (!hasScope("…")) return denyScope(...)` (audited as `denied`). Legacy 6-scope connections are grandfathered to the full set via `effectiveScopes()`.
- **`admin:destructive` (`ADMIN_SCOPE`) — owner-only.** Gates irreversible paths on top of the write scope: `delete_task`, `delete_block`, `cancel_order` with `force:true` (paid order), `update_payment` status → canceled/refunded, `update_boarding_stay` status → canceled on a `checked_in` stay (dry_run answers "דורש admin:destructive — בעלים בלבד" instead of previewing). Admin checks run BEFORE `findIdempotentReplay`/any DB read (boarding: right after the stay lookup, since the status is needed). `block_time all_day:true` and normal unpaid `cancel_order` need no admin scope.
- **Role capping — `capScopesForRole(scopes, role, isPlatformAdmin)`.** Owner/platform-admin → unchanged; manager → minus `MANAGER_DENIED_SCOPES` (`read:analytics`, `write:payments`, `admin:destructive`); staff/other → read-only. Applied at mint time AND on every `validateMcpToken` (re-capped to the minter's CURRENT role — demoted manager's token shrinks; token dies when the minter leaves the business). Grandfathered tokens whose minter is now a manager lose admin too.
- **Token metadata:** `McpConnection` carries `createdByUserId` / `createdByRole` / `expiresAt` (180 days). Profiles `read | intake | calendar | boarding | full` via `MCP_PROFILES` (labels `MCP_PROFILE_LABELS`); `full` = everything the minter's role allows.

### 64 Tools + 2 prompts — `src/app/api/mcp/route.ts` + modules in `src/lib/mcp/`
Core (route.ts, 20): `list_clients` (cursor), `get_client`, `create_client`, `add_client_note`, `list_upcoming_appointments`, `list_services`, `create_appointment`, `update_appointment`, `cancel_appointment`, `get_business_stats`, `list_leads` (city/source/created, created_from/to, stage_name, offset, include_closed), `get_lead` (full card + whole journal: 50 call logs/stage changes with treatment, follow-up task history), `create_lead` (stage_name / next_follow_up / pet_* fields), `list_orders`, `get_order`, `create_order`, `list_tasks`, `list_pets`, `list_boarding_stays`, `list_training_programs`, `send_reminder`.
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

### Critical: Middleware bypass
`/api/mcp` is in `PUBLIC_EXACT_PATHS` in `src/middleware.ts` — **exact match only**, not a prefix.
This is intentional: MCP does its own token auth internally; the edge middleware must not block it.

### Kill switch
`MCP_ENABLED` env var — if set to `"false"`, all MCP requests return 503 immediately.
Runbook: `docs/operations.md`

### Rate limiting
- Per-token: 100 req/min
- Per-IP fail: 10 req/min (login protection)
Both use `rateLimitAsync()` from `src/lib/rate-limit.ts` (Upstash Redis-backed).

### Paywall
Settings tab "עוזרי AI" gated to `basic+`. The MCP endpoint itself doesn't enforce tier — token possession implies the user already passed the paywall when creating the connection.

### Claude Desktop config snippet
```json
{
  "petra": {
    "url": "https://petra-app.com/api/mcp",
    "headers": { "Authorization": "Bearer <token from הגדרות → עוזרי AI>" }
  }
}
```

---

## WhatsApp — per-business numbers (Meta Embedded Signup)

Full doc: `docs/whatsapp-per-business.md`.
- `sendWhatsAppMessage` / `sendWhatsAppTemplate` accept `businessId?` + `context?`. **Always pass `businessId`** from any caller that has one — `resolveWhatsAppSender()` (`src/lib/whatsapp-connections.ts`) picks the business's own number when `WhatsAppConnection.status === "active"` **and** the template is APPROVED on its WABA (`templatesJson`), otherwise the platform number (`META_PHONE_NUMBER_ID`). Business auth failure → connection flips to `error` + one retry via platform. Unconnected businesses behave exactly as before.
- Token stored AES-256-GCM in `accessTokenEnc` (`WHATSAPP_ENCRYPTION_KEY`, fallback `GCAL_ENCRYPTION_KEY`); disconnect blanks it. Never log it.
- Routes: `GET/POST/DELETE /api/integrations/whatsapp/connection` (+ `/sync-templates`). POST/DELETE = owner/manager/platform-admin; POST needs tier `whatsapp_reminders` + `isWhatsAppEmbeddedSignupConfigured()`; `businessId` from session only.
- UI: `src/components/settings/WhatsAppConnectCard.tsx` inside Settings → אינטגרציות (FB JS SDK; CSP in `next.config.mjs` allows connect.facebook.net / www.facebook.com / graph.facebook.com). Shows "בקרוב" until `NEXT_PUBLIC_META_APP_ID` + `NEXT_PUBLIC_META_ES_CONFIG_ID` + `META_APP_SECRET` are set.
- Webhook `/api/webhooks/whatsapp-status` serves ALL subscribed WABAs; routes by `metadata.phone_number_id` → `findBusinessIdByPhoneNumberId`; verifies `X-Hub-Signature-256` when `META_APP_SECRET` is set.
- Prod DDL for new tables: additive SQL via `prisma db execute --url $DIRECT_URL` (never `db push`).

---

## Key Patterns

Toasts (`sonner`), React Query (queries/mutations with `invalidateQueries`), and Prisma imports follow standard library usage — copy the pattern from any existing route/component.

### env.ts — server-side only
```typescript
import { env, isDev, isProd } from "@/lib/env";
// Never import from a Client Component
```

### CSS
- Tailwind only. RTL via `<html dir="rtl">`.
- Custom aliases: `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.card`, `.modal-overlay`, `.modal-content`

---

## Quick Reference

| Thing | Location |
|-------|---------|
| Feature flags / tier limits | `src/lib/feature-flags.ts` |
| `usePlan()` hook | `src/hooks/usePlan.ts` |
| `TierGate` component | `src/components/paywall/TierGate.tsx` |
| WhatsApp send | `src/lib/whatsapp.ts` — `sendWhatsAppMessage()` |
| WhatsApp reminder (manual) | `POST /api/appointments/[id]/remind` — requires `whatsapp_reminders` tier (PRO+) |
| WhatsApp reminder (auto) | `src/lib/reminder-service.ts` — `scheduleAppointmentReminder()` checks `whatsappRemindersEnabled` + tier |
| Message template defaults | `STARTER_TEMPLATES` in `src/components/messages/messages-panel.tsx` — 8 templates with automated footer; pencil button opens editor modal pre-filled from DB version |
| Form validation utils | `src/lib/validation.ts` — `validateIsraeliPhone`, `validateEmail`, `sanitizeName`, `validateName` |
| Service dog phases | `src/lib/service-dogs.ts` — `SERVICE_DOG_PHASES` (single source of truth; VALID_PHASES derived from it) |
| Service dog types | `src/lib/service-dogs.ts` — `SERVICE_DOG_TYPES` (MOBILITY, PSYCHIATRIC, PTSD, GUIDE, AUTISM, ALERT, OTHER) |
| Service dog placement statuses | `src/lib/service-dogs.ts` — `SERVICE_DOG_PLACEMENT_STATUSES` (ACTIVE + TERMINATED only) |
| Service dog location options | `src/lib/service-dogs.ts` — `LOCATION_OPTIONS` |
| Medical protocol categories | `MEDICAL_PROTOCOL_CATEGORIES` — order: חיסונים→טיפולים→בדיקות בריאות; label "טיפולים" (not "טפילים"); PARK_WORM = "תולעת הפארק" |
| Medical protocol label display | Render `MEDICAL_PROTOCOL_MAP[key]?.label ?? storedLabel` — overrides stale DB labels |
| Medical protocol date sync | `service-dog-engine.ts` — DEWORMING: `dewormingValidUntil` direct when set, else `lastDate+180d`; PARK_WORM: `parkWormValidUntil` |
| Recipient stages | `src/app/api/service-recipient-stages/route.ts` — `DEFAULT_STAGES` (upserted on every GET; REJECTED = archive stage) |
| Sidebar | `src/components/layout/sidebar.tsx` |
| App shell | `src/components/layout/app-shell.tsx` |
| Auth guards | `src/lib/auth-guards.ts` |
| Session | `src/lib/session.ts` — `SESSION_TTL_REMEMBER_ME` for 30-day sessions |
| Current user (client) | `useAuth().user` — has `isAdmin: boolean`, NOT `platformRole` |
| Orders API date filters | `from`/`to` → filter by `createdAt` (orders list); `startFrom`/`startTo` → filter by `startAt` (calendar view) |
| Owner stats API | `GET /api/owner/stats` — includes `gcalConnectedCount` (Business.gcalConnected=true count, limit 100 in Testing mode) |
| Owner notifications | `src/lib/notify-owner.ts` — `notifyOwnerNewUser()` sends WhatsApp + email on new registration |
| SEO sitemap | `src/app/sitemap.ts` — 6 public URLs, `/landing` priority 1.0 |
| SEO robots | `src/app/robots.ts` — allows landing/register/login, disallows api/admin/dashboard |
| System messages dropdown | Mail-envelope dropdown in `src/components/layout/topbar.tsx` (~line 505) — title "הודעות מפטרה"; queryKey `["systemMessages"]`; `PATCH /api/system-messages/[id]` with `{ isRead: true }` marks read (does NOT delete). `/api/system-messages` is also consumed by `business-admin/page.tsx` (`?all=true`, queryKey `["system-messages-admin"]`) |
| Customers page | Selection mode: "בחר" button toggles `selectionMode`; checkboxes hidden by default. Email badge → Gmail compose (`https://mail.google.com/mail/?view=cm&to=...`). No quick-book button. |
| Tasks page | Same selection mode pattern as customers (`selectionMode` state, "בחר" button, "בטל בחירה" exits mode) |
| Service dog tabs order | תיק כלב → חיסונים וטיפולים → שיבוצים → מבחני הסמכה → מסמכים → ביטוח → ציוד → פרוטוקולים רפואיים → יומן אימונים → תעודת הסמכה |
| Boarding room map print | `@media print` in `boarding/page.tsx` hides `.modal-overlay` — prevents "לקוח חדש" modal appearing in print |
| Feeding board print | `boarding/daily/page.tsx` has print button + `@media print` CSS hiding nav/modals |
| Boarding yards print | `boarding/yards/page.tsx` — print CSS hides sidebar/header via `no-print` class; `data-print-yards` attr on main div; 2-col grid for print; print-only heading injected |
| Bug report (Help Center) | `src/components/help/HelpCenter.tsx` — FileReader reads screenshot as base64 (max 2MB); sent to `/api/support/report` as `screenshotBase64`; API attaches to Resend email as attachment; tickets visible at `/owner/support` + emailed to `info@petra-app.com` |
| Notes length validation | `POST /api/appointments` + `POST /api/orders` — max 2000 chars; returns 400 with Hebrew error message |
| Dashboard stat cards | "הכנסות החודש" always shown (from `data.monthRevenue`); "היום: ₪X" as subtitle when today > 0. `data.upcomingByType` and dead `BirthdayWidget` component exist but are unused. |
| Dashboard orders section | "הזמנות אחרונות" links to `/orders`; each row is a `<Link>` to `/orders/:id` |
| Lead WhatsApp alert | `customers/[id]/page.tsx`: blue Send button on completed appointments (follow-up wa.me). Birthday Gift button on pet card hover. `customers/page.tsx`: "שלח ברוכים הבאים" toast action on new customer creation. |
| Onboarding wizard | `src/app/onboarding/page.tsx` — 5-step full-page flow (Welcome→Client→Pricing→GCal→Done). Shown to new users redirected from register. |
| Onboarding checklist | `src/components/onboarding/SetupChecklist.tsx` — 7-step widget on dashboard (4 core + 3 advanced). Dismissed via "דלג" (sets `skipped:true`). |
| Onboarding progress API | `GET /api/onboarding/progress` — smart live detection: step1=business.phone set, step2=service.count>0, step3=customer.count>0, step4=appointment.count>0, step5=order.count>0, step6=contractTemplate.count>0, step7=whatsappRemindersEnabled. `PATCH` updates `skipped`/`completedAt`/`stepCompleted1-4`. |
| Onboarding DB models | `OnboardingProfile` (businessType, activeClientsRange, primaryGoal) + `OnboardingProgress` (currentStep, stepCompleted1-4, skipped, completedAt, lastCustomerId) — both keyed on `userId`. |
| Onboarding guard | `src/components/onboarding/OnboardingGuard.tsx` — wraps dashboard layout; redirects brand-new users (no progress record) to `/dashboard`; allows through once `skipped` or `completedAt` set. |
| Settings tabs | "פרטי העסק" (business info only) · "הזמנות" (AvailabilityTab + online booking, PRO+) · "פנסיון" (boarding settings, BASIC+) · "תשלומים" (InvoicingTab + ContractsTab, BASIC+) · "צוות" · "הודעות" · "אינטגרציות" · "כלבי שירות" · "נתונים" |
| MCP endpoint | `POST /api/mcp` — Streamable HTTP, stateless, SHA-256 bearer auth |
| MCP token management | `POST/GET/DELETE /api/mcp/connections` — create (shown once), list, revoke |
| MCP auth lib | `src/lib/mcp-auth.ts` — `generateMcpToken()`, `validateMcpToken()`, `auditLog()`, `DEFAULT_MCP_SCOPES` |
| MCP allowlist | `src/lib/mcp-allowlist.ts` — `isMcpAllowedEmail()`, `isMcpAllowedBusiness()`; env `MCP_ALLOWED_EMAILS`, `MCP_BETA_OPEN` |
| MCP settings UI | `src/components/settings/McpConnectionsTab.tsx` — Settings → "עוזרי AI" (paywall: basic+) |
| MCP help page | `src/app/(dashboard)/help/connect-ai/page.tsx` — step-by-step guide for Claude Desktop |
| MCP owner dashboard | `src/app/owner/mcp/page.tsx` + `GET /api/owner/mcp-stats` — active connections, calls/24h, errors, popular tools |
| MCP DB models | `McpConnection` (businessId, name, tokenHash, scopes, lastUsedAt, revokedAt) + `McpAuditLog` (connectionId, toolName, params, status, resultSummary) |
| Service layer | `src/services/` — 11 domains; all business logic; API routes only do auth + call service. See `docs/service-layer.md` |
| ServiceError | `throw new ServiceError(message, code)` — codes: NOT_FOUND / UNAUTHORIZED / VALIDATION / CONFLICT / EXTERNAL |
