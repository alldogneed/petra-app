# Petra App — AI Agent Reference

**Petra** is a Hebrew/RTL B2B SaaS for Israeli pet-service businesses (dog trainers, boarding, groomers).
Stack: Next.js 14, TypeScript, Prisma/PostgreSQL, React Query, Tailwind, sonner toasts.

Full reference docs in `docs/`:
- `docs/architecture.md` — tech stack, folder structure, DB schema, env vars
- `docs/features.md` — feature map, tier enforcement, cron jobs
- `docs/conventions.md` — code patterns, how to run, known issues
- `docs/deployment.md` — branches, Vercel, Supabase, WhatsApp status

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

---

## Key Patterns

### Toasts
```typescript
import { toast } from "sonner";
toast.success("לקוח נוסף בהצלחה");
toast.error("שגיאה בשמירה");
```

### React Query
```typescript
const { data } = useQuery({ queryKey: ["x"], queryFn: () => fetch("/api/x").then(r => r.json()) });
const mutation = useMutation({
  mutationFn: (d) => fetch("/api/x", { method: "POST", body: JSON.stringify(d) }).then(r => r.json()),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["x"] }); toast.success("..."); },
});
```

### env.ts — server-side only
```typescript
import { env, isDev, isProd } from "@/lib/env";
// Never import from a Client Component
```

### Prisma import (both work)
```typescript
import prisma from "@/lib/prisma"
import { prisma } from "@/lib/prisma"
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
| In-app notifications bell | `src/components/layout/InAppNotificationBell.tsx` — title "הודעות מערכת"; per-message "קראתי" button (dismiss); "קראתי הכל" dismisses all |
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
