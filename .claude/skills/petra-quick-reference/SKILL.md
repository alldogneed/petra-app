---
name: petra-quick-reference
description: "Petra \"where does X live\" lookup table moved out of CLAUDE.md — file and route locations for feature flags, reminders, message templates, validation utils, service-dog constants, medical protocols, session, current user, orders API filters, owner stats, notifications, system messages, customers/tasks pages, print views, help center, onboarding, settings tabs and more. Load when you need to find where a Petra feature, constant, route or component is implemented, or before changing one of those areas."
---

# Petra — Quick reference

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

| Thing | Location |
|-------|---------|
| Feature flags / tier limits | `src/lib/feature-flags.ts` |
| `usePlan()` hook | `src/hooks/usePlan.ts` |
| `TierGate` component | `src/components/paywall/TierGate.tsx` |
| WhatsApp send | `src/lib/whatsapp.ts` — `sendWhatsAppMessage()` |
| WhatsApp reminder (manual) | `POST /api/appointments/[id]/remind` — requires `whatsapp_reminders` tier (PRO+) |
| WhatsApp reminder (auto) | `src/lib/reminder-service.ts` — `scheduleAppointmentReminder()` checks `whatsappRemindersEnabled` + tier |
| Message template defaults | `STARTER_TEMPLATES` in `src/components/messages/messages-panel.tsx` — 8 templates with automated footer; pencil button opens editor modal pre-filled from DB version |
| Scheduled message preview | `GET /api/scheduled-messages/[id]` → `MessagePreview` (custom text, or approved Meta template text from `getPlatformTemplateTexts()` filled with params). `src/lib/scheduled-message-preview.ts` — `messageLabel`, `renderTemplateText`, `confirmationLogPayload`. `appointment_confirmation_log` rows now store what went out (`flow` + `templateChain`/`body`); empty legacy rows are rebuilt from the appointment. Content cell in `/scheduled-messages` opens the preview modal |
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
| SEO robots | `src/app/robots.ts` — allows landing/register/login, disallows api/admin/owner/dashboard |
| System messages dropdown | Mail-envelope dropdown in `src/components/layout/topbar.tsx` — title "הודעות מפטרה"; queryKey `["systemMessages"]`. Clicking a row opens a detail modal; its action button uses `router.push` for app paths and a new tab for `/api/` file links and external URLs. `/api/system-messages` is also consumed by `business-admin/page.tsx` (`?all=true`) |
| Topbar panels on mobile | The topbar `<header>` has `backdrop-filter` → it is the containing block for `position:fixed` children. Envelope/bell panels go through `TopbarPanel` (phones: portaled to `<body>` with backdrop + X; desktop: dropdown) and the message detail modal is portaled. Never render a full-screen layer inside the header. Outside-click ignores `[data-topbar-panel]`; Esc closes. |
| Pull-to-refresh | `src/components/layout/PullToRefresh.tsx` (mounted in AppShell, touch devices only): pull ≥70px at scrollTop 0 → `invalidateQueries({refetchType:"active"})` + `router.refresh()`. Sets `overscroll-behavior-y: none` (no native reload). Skipped when a dialog/sheet is open, body scroll locked, inside inputs, inner scrollers not at top, or `[data-no-pull-refresh]` (use it on maps/kanban/drag areas that pull down). |
| Customers page | Selection mode: "בחר" button toggles `selectionMode`; checkboxes hidden by default. Email badge → Gmail compose (`https://mail.google.com/mail/?view=cm&to=...`). No quick-book button. |
| Tasks page | Same selection mode pattern as customers (`selectionMode` state, "בחר" button, "בטל בחירה" exits mode) |
| Service dog tabs order | תיק כלב → חיסונים וטיפולים → שיבוצים → מבחני הסמכה → מסמכים → ביטוח → ציוד → פרוטוקולים רפואיים → יומן אימונים → תעודת הסמכה |
| Boarding room map print | `@media print` in `boarding/page.tsx` hides `.modal-overlay` — prevents "לקוח חדש" modal appearing in print |
| Feeding board print | `boarding/daily/page.tsx` has print button + `@media print` CSS hiding nav/modals |
| Boarding yards print | `boarding/yards/page.tsx` — print CSS hides sidebar/header via `no-print` class; `data-print-yards` attr on main div; 2-col grid for print; print-only heading injected |
| Bug report (Help Center) | `src/components/help/HelpCenter.tsx` — FileReader reads screenshot as base64 (max 2MB); sent to `/api/support/report` as `screenshotBase64`; API attaches to Resend email as attachment; tickets visible at `/owner/support` + emailed to `info@petra-app.com` |
| Notes length validation | `POST /api/appointments` + `POST /api/orders` — max 2000 chars; returns 400 with Hebrew error message |
| Dashboard stat cards | "הכנסות החודש" always shown (from `data.monthRevenue`); "היום: ₪X" as subtitle when today > 0. `data.upcomingByType` exists but is unused. Each card can be hidden per member (rule #36). |
| Dashboard orders section | "הזמנות אחרונות" links to `/orders`; each row is a `<Link>` to `/orders/:id` |
| Lead deal value | `src/lib/lead-deal-value.ts` — edited in `LeadTreatmentModal`; column totals in `leads/page.tsx`; `getAnalytics().leadSales` ("מכירות מלידים" in `/analytics`); DDL `prisma/lead_deal_value.sql` |
| Customer sales history | `src/lib/lead-sales-history.ts` + `getCustomerSalesHistory()` + `GET /api/customers/[id]/sales-history` → `CustomerSalesHistory.tsx` card on the customer page (after Pets) |
| Lead traffic attribution | `src/lib/lead-attribution.ts` — `classifyTrafficSource`, `normalizeAttributionInput`, `formatAttributionLine`, `buildLeadAttributionReport`; DDL `prisma/lead_attribution.sql`; report tables in `/analytics` (12 months) |
| Lead WhatsApp alert | `customers/[id]/page.tsx`: blue Send button on completed appointments (follow-up wa.me). Birthday Gift button on pet card hover. `customers/page.tsx`: "שלח ברוכים הבאים" toast action on new customer creation. |
| Onboarding wizard | `src/app/onboarding/page.tsx` — 5-step full-page flow (Welcome→Client→Pricing→GCal→Done). Shown to new users redirected from register. |
| Onboarding checklist | `src/components/onboarding/SetupChecklist.tsx` — 7-step widget on dashboard (4 core + 3 advanced). Dismissed via "דלג" (sets `skipped:true`). |
| Onboarding progress API | `GET /api/onboarding/progress` — smart live detection: step1=business.phone set, step2=service.count>0, step3=customer.count>0, step4=appointment.count>0, step5=order.count>0, step6=contractTemplate.count>0, step7=whatsappRemindersEnabled. `PATCH` updates `skipped`/`completedAt`/`stepCompleted1-4`. |
| Onboarding DB models | `OnboardingProfile` (businessType, activeClientsRange, primaryGoal) + `OnboardingProgress` (currentStep, stepCompleted1-4, skipped, completedAt, lastCustomerId) — both keyed on `userId`. |
| Onboarding guard | `src/components/onboarding/OnboardingGuard.tsx` — wraps dashboard layout; redirects brand-new users (no progress record) to `/dashboard`; allows through once `skipped` or `completedAt` set. |
| Settings tabs | `SETTINGS_TABS` (rule #35), 5 groups: העסק (פרטי העסק · מנוי וחיוב) · תפעול (זמינות והזמנות `online_bookings` · פנסיון `boarding` · כלבי שירות · חוזים `contracts`) · תקשורת וצוות (הודעות ואוטומציות · צוות והרשאות, owner) · חיבורים ונתונים (אינטגרציות · עוזרי AI · ייבוא וייצוא) · החשבון שלי (פרופיל ואבטחה: name, password, 2FA, sessions) |
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
