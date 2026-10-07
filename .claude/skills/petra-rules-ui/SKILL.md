---
name: petra-rules-ui
description: "Petra UI invariants moved out of CLAUDE.md (rules 20-23, 25, 29, 35, 36): analytics page is named \"דוחות\", sidebar nav grouped by eyebrows, marketing stats kept aligned between login hero and AnimatedStats, subscription expiry banner only for paid tiers, global search modal must close on mobile, PetraLoader is the only data-loading indicator (no grey skeletons, never paw without wordmark), settings screen tab config + shared save hook + read-only mode, dashboard per-member layout where permissions win and every number is a link. Load BEFORE editing the sidebar, topbar, dashboard, settings screen, login/landing stats, loading states, global search or any page-level layout."
---

# Petra — UI & screens — rules

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### 20. Analytics page is named "דוחות"
Sidebar entry and page title are "דוחות" (not "אנליטיקס"). Route remains `/analytics`.
`src/components/layout/sidebar.tsx` line: `{ name: "דוחות", href: "/analytics", ... }`

### 21. Sidebar nav is grouped by eyebrows
`navEntries` in `src/components/layout/sidebar.tsx` is interleaved with `{ eyebrow: "..." }` markers. Three sections: **תפריט ראשי** (dashboard/customers/leads/tasks/scheduler/calendar), **מודולים** (boarding/pricing/service-dogs/training/pets), **ניהול** (analytics/business-admin/settings). When adding a new nav item, place it in the correct group; eyebrows render as uppercase white/40 labels above each group.

### 22. Marketing stats must stay aligned
Login hero (`src/app/login/page.tsx`) and `AnimatedStats.tsx` both display the same three metrics: **130 / 5,000+ / 98%**. Update both files together if any number changes.

### 23. Subscription expiry banner only for paid tiers
Dashboard renewal banner uses `!isFree && subscriptionActive && subscriptionDaysLeft <= 14`. Never show "renew" warning to a user on free tier even if they have a stale `subscriptionEndsAt` from a former paid plan.

### 25. Search modal must close on mobile
`src/components/search/global-search.tsx` has a permanent X button in the header (always visible, not just when `query` is filled) **and** the backdrop+dialog wrapper is a single layer so taps outside the modal close it. Without these two together, mobile users get stuck — no ESC key, X is hidden, backdrop click eaten by the dialog wrapper.

### 29. Loading states — `PetraLoader` is the ONLY data-loading indicator
`src/components/ui/PetraLoader.tsx` (bouncing paw + PETRA wordmark, from the "Petra Splash" design). No grey `animate-pulse` skeleton blocks, no "טוען..." cards, no section spinners.
- `<PetraLoader />` (`page`, default) — main body of a screen/tab is loading. Fixed at the center of the content area (sidebar inset via `data-petra-shell` on AppShell), portaled to `<body>`, translucent backdrop. No wrapper needed; inside `<tbody>` use `<tr><td colSpan={N}><PetraLoader /></td></tr>`.
- `variant="inline"` — modals, dropdowns, side panels, a single card on an otherwise loaded screen. `className` may override padding (`py-4` for compact spots).
- `variant="splash"` — full-screen, no app shell: root `loading.tsx`, `OnboardingGuard`, public pages (`/book`, `/sign`, `/intake`, `/my-booking`, `/checkout`, `/payment*`), login after success.
- Never ship the paw without the wordmark. Toes are `border-radius: 50%` (not Tailwind `rounded-full` — renders pills).
- Leave alone: spinners inside buttons, refresh icons, "טען עוד", decorative status dots/pings, tiny inline number placeholders. Customer portal `/c/[slug]` keeps its white-label loader.

### 35. Settings screen — tab config, shared save hook, read-only mode
`src/app/(dashboard)/settings/page.tsx` is only the shell; each tab is a file in `src/components/settings/`.
- **Tabs** come ONLY from `SETTINGS_TABS` in `src/components/settings/settings-tabs.ts` (id = `?tab=` value, label, group, `feature` from `feature-flags.ts` or `paidOnly`, `visibility`). The nav lock icon and the `PaywallCard` both use `isTabLocked()` — never hardcode tier sets in the page. Tab ids are linked app-wide: never rename one; add an alias in `TAB_ALIASES` instead. The URL is the source of truth (refresh/back/deep links); `?gcal=` opens integrations.
- **Business-column forms** use `useBusinessSettings({ dirtyKey })` (`src/hooks/useBusinessSettings.ts`): draft of touched fields → PATCH `/api/settings` with ONLY the changed fields, `SettingsSaveBar` (`settings-ui.tsx`) for save/discard. Custom forms register with `useRegisterDirty(key, dirty)` — the shell then confirms before switching tab / following a link / reload.
- **Read-only:** PATCH `/api/settings`, `/api/settings/logo` and `/api/service-dogs/vaccinations/apply-schedule` require `SETTINGS_CRITICAL` (owner, or an owner-granted override). UI: `usePermissions().canCriticalSettings` false → `<ReadOnlyNotice/>` + `<SettingsFieldset readOnly>`.
- Logo upload AND removal save immediately (no save bar). `POST /api/subscription/cancel` is owner-only and logs `CANCEL_SUBSCRIPTION`. Use `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`) — no `window.confirm` in settings; every disconnect/delete/regenerate asks first.

### 36. Dashboard — per-member layout, permissions win, every number is a link
- **Design & files:** "Petra Dashboard" design (Claude Design, 2026-10). `dashboard/page.tsx` = shell only (header, date nav, actions, KPI strip, boarding/appointments/orders/activity/open-tasks cards, `renderBlock`); each widget lives in `src/components/dashboard/widgets/*`; shared types/labels in `dashboard-shared.tsx`; ALL visuals use the primitives in `src/components/dashboard/dash-ui.tsx` (DashCard, DashCardHeader, DashLink, DashRow/DashLinkRow, Segmented, MiniButton, WaIconButton/WaTextButton, TaskCheckbox, PriorityDot, StatusDot). Flat white cards, no coloured top borders/icon tiles/pills — status = coloured text. KPI strip = one card, `auto-fit minmax(150px)`, 2 columns on phones (odd last card spans).
- Widgets come ONLY from `src/lib/dashboard-widgets.ts`: `DASHBOARD_BLOCKS` (id, label, hint, `span` full/half, `requires` finance/revenue/leads/activity) + `DASHBOARD_STATS` (stat cards). `dashboard/page.tsx` renders `renderBlock(id)` for `layoutBlocks(visibleBlocks(prefs, flags))`; consecutive half blocks pair up, a lone half spans the row. Wrappers use `empty:hidden`, so a block that returns null leaves no gap.
- Prefs = `BusinessUser.dashboardPrefs` `{ v, hidden, order }` — per member, per business, stored server-side. `GET/PUT /api/dashboard/preferences` (`src/services/dashboard-prefs.ts`) reads `businessId` + `userId` from the session only; body ids are ignored; `{prefs:null}` resets. Inactive/absent membership (impersonating admin) → read defaults, PUT 403. `normalizeDashboardPrefs()` drops unknown ids → stored JSON is bounded by the catalog.
- Prefs only HIDE/REORDER: `requires` is checked first (`isAllowed`) and the server keeps withholding money (`canSeeRevenueSummary`). Never let a pref show a widget the role can't see.
- `hidden` (not "visible") is stored, so a new widget appears for everyone; `resolveBlockOrder()` slots blocks missing from a saved order right after their default predecessor. A new widget = catalog entry + `case` in `renderBlock` (+ `requires` if gated).
- Defaults when never saved: `defaultHiddenFor(owner's OnboardingProfile.businessType)` (מאלף → no boarding/medications; מספרה → also no vaccinations).
- Every number/row links to the filtered target: `/payments?status=&period=`, `/orders?status=&payment=` (deep link drops the 30-day default window; "הזמנות פעילות" → `status=active` = `ACTIVE_ORDER_STATUSES` draft+confirmed in `src/lib/constants.ts`, shared by the dashboard count, `listOrders()` and the orders export), `/tasks?filter=|task=<id>`, `/leads?lead=<id>|view=followup`, `/calendar?date=`. Activity feed rows use `entityHref()` (`/api/dashboard/activity` returns `href`). Prod DDL: `prisma/dashboard_prefs.sql`. Tests: `src/lib/__tests__/dashboard-widgets.test.ts`.
