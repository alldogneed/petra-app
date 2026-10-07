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

### 16. `shadcn init` destroys utils.ts
Restore: `DEMO_BUSINESS_ID`, `formatCurrency`, `formatDate`, `formatTime`, `getStatusColor`, `getStatusLabel`, `toWhatsAppPhone`, `getTimelineIcon`

### 24. Dev webpack uses memory cache (Hebrew path)
`next.config.mjs` sets `config.cache = { type: "memory" }` in dev. The default PackFileCacheStrategy fails snapshot resolve on the Hebrew project path (`פיתוח`) and stalls compilation. Don't remove. Production build uses default cache and is unaffected.

When adding a rule: a rule every task must know goes here; an area rule goes in that area's skill below, with the next free number, and is listed in the table.

---

## Rules by area — load the skill BEFORE touching that area

These rules are just as binding as the ones above. They live in lazy skills (`.claude/skills/<name>/SKILL.md`) so they do not cost context in every session. **Before editing code in an area, load its skill with the Skill tool and follow it.** Rule numbers are unchanged.

| Skill | Rules |
|---|---|
| `petra-rules-service-dogs` | **12** Service dog phases — single source of truth · **13** Recipient stages — REJECTED = archive · **14** Placement statuses — only 2 · **15** Service dog types — includes PTSD |
| `petra-rules-leads` | **18** Leads Kanban — sort vs badge must match · **19** Lead notifications — PRO+ only · **27** Lead traffic attribution — `trafficSource` ≠ `source` · **28** Lead deal value — `dealValue` is NOT revenue · **31** Customer sales history — the lead journal follows the customer |
| `petra-rules-whatsapp` | **26** Automated customer WhatsApp sends go through the ordered template chain · per-business WhatsApp numbers (Meta Embedded Signup) |
| `petra-rules-ui` | **20** Analytics page is named "דוחות" · **21** Sidebar nav is grouped by eyebrows · **22** Marketing stats must stay aligned · **23** Subscription expiry banner only for paid tiers · **25** Search modal must close on mobile · **29** Loading states — `PetraLoader` is the ONLY data-loading indicator · **35** Settings screen — tab config, shared save hook, read-only mode · **36** Dashboard — per-member layout, permissions win, every number is a link |
| `petra-rules-customers` | **17** Customer DELETE — sequential, NO $transaction · **37** Customers — one balance, server-side filters, shared access rule · **38** Customer card — summary contract + section components · **39** Merging duplicate customers |
| `petra-rules-permissions` | **32** Activity log — always pass `businessId` + entity · **33** "ניהול ובקרה" (`/business-admin`) — owner only · **34** Permission matrix is enforced server-side — use overrides · **40** Platform admin = one panel at `/owner` (no `/admin` UI) · **41** Screen (view) permissions — `VIEW_SCREENS` is the single source |
| `petra-rules-reports` | **30** Reports — shared definitions, server-side only |
| `petra-mcp-reference` | MCP auth, allowlist, scopes/role capping, tool modules and conventions, rate limits, paywall, OAuth, Claude Desktop config |
| `petra-quick-reference` | "Where does X live" table — files, routes and components per feature |

---

## MCP Server

### Architecture
```
Supabase ← src/services/ ← { API routes | MCP tools }
```
Both UI routes and MCP tools call the same service functions. No duplicated business logic.

### Critical: Middleware bypass
`/api/mcp` is in `PUBLIC_EXACT_PATHS` in `src/middleware.ts` — **exact match only**, not a prefix.
This is intentional: MCP does its own token auth internally; the edge middleware must not block it.

### Kill switch
`MCP_ENABLED` env var — if set to `"false"`, all MCP requests return 503 immediately.
Runbook: `docs/operations.md`

Everything else about the MCP server → skill `petra-mcp-reference` (load it before touching `src/app/api/mcp`, `src/lib/mcp/*`, `mcp-auth.ts`, `mcp-oauth.ts`, `mcp-allowlist.ts`).

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
