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

### 12. `shadcn init` destroys utils.ts
Restore: `DEMO_BUSINESS_ID`, `formatCurrency`, `formatDate`, `formatTime`, `getStatusColor`, `getStatusLabel`, `toWhatsAppPhone`, `getTimelineIcon`

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
| Message template defaults | `STARTER_TEMPLATES` in `src/components/messages/messages-panel.tsx` — 8 templates with automated footer |
| Form validation utils | `src/lib/validation.ts` — `validateIsraeliPhone`, `validateEmail`, `sanitizeName`, `validateName` |
| Service dog location options | `src/lib/service-dogs.ts` — `LOCATION_OPTIONS` |
| Sidebar | `src/components/layout/sidebar.tsx` |
| App shell | `src/components/layout/app-shell.tsx` |
| Auth guards | `src/lib/auth-guards.ts` |
| Session | `src/lib/session.ts` — `SESSION_TTL_REMEMBER_ME` for 30-day sessions |
| Current user (client) | `useAuth().user` — has `isAdmin: boolean`, NOT `platformRole` |
| Orders API date filters | `from`/`to` → filter by `createdAt` (orders list); `startFrom`/`startTo` → filter by `startAt` (calendar view) |
| Owner stats API | `GET /api/owner/stats` — includes `gcalConnectedCount` (Business.gcalConnected=true count, limit 100 in Testing mode) |
