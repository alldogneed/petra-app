# Petra App - Complete AI Agent Rebuild Guide

## Quick Summary
**Petra** is a Hebrew/RTL pet business management SaaS app.
Target users: Dog trainers, boarding facilities, groomers in Israel.

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **UI**: Tailwind CSS + shadcn/ui (new-york style) + Heebo font
- **Database**: Prisma ORM with PostgreSQL (prod) / SQLite (dev) — schema at `prisma/schema.prisma`
- **State**: React Query (@tanstack/react-query v5) for server state
- **Icons**: lucide-react
- **Auth**: Email+password login via bcryptjs, session-based with `petra_session` cookie (7 day expiry)

## Environment Setup

### Node.js (CRITICAL)
Node.js v20.11.1 is at `/Users/or-rabinovich/local/node/bin/` and is NOT in PATH.
**Always prefix commands:**
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate
```

### Dev Server
The project path contains Hebrew characters. `npm run dev` will FAIL with `spawn sh ENOENT`.
**Use this instead:**
```bash
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'; node node_modules/.bin/next dev) > /tmp/petra-dev.log 2>&1 &
```

### Database
- **Provider**: PostgreSQL (switched from SQLite for Vercel compatibility)
- **Recommended**: [Neon](https://neon.tech) free tier — get `DATABASE_URL` + `DIRECT_URL` from project dashboard
- Set both vars in `.env` and in Vercel project settings
- After setting up DB: `PATH="..." npx prisma db push && npx prisma generate`
- Seed demo data: `node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed.ts')"`
- Seed admin users: `node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed-admin.ts')"`

## Key Constants & Auth
- `DEMO_BUSINESS_ID = "demo-business-001"` in `src/lib/utils.ts` — used only in public/platform routes and seed scripts
- **Authenticated API routes use `requireBusinessAuth(request)`** — returns `{ session, businessId }` from the user's active `BusinessUser` membership. NEVER hardcode `DEMO_BUSINESS_ID` in a protected route.
- Auth: middleware at `src/middleware.ts` protects all routes except `/login`, `/api/auth/*`, `/book`, `/intake`
- Test accounts: `owner@petra.local` / `Admin1234!` (owner), `admin@petra.local` / `Admin1234!`, `superadmin@petra.local` / `Admin1234!`
- Business record MUST exist in DB before creating dependent records (FK constraint)
- Demo accounts (owner, admin, superAdmin) all have `BusinessUser` membership linked to `demo-business-001`, so `requireBusinessAuth` returns `"demo-business-001"` for them.

---

## Dependencies

The `package.json` has all required dependencies. After cloning, run:
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install
```

Key runtime deps: `@prisma/client`, `@tanstack/react-query`, `lucide-react`, `clsx`, `tailwind-merge`, `bcryptjs`, `class-variance-authority`, `@radix-ui/*`, `@dnd-kit/*`
Key dev deps: `prisma`, `ts-node`, `tailwindcss-animate`, `eslint-config-next`

### WARNING: shadcn init Overwrites utils.ts
Running `npx shadcn init` replaces `src/lib/utils.ts` with just the `cn` function.
You MUST restore: `DEMO_BUSINESS_ID`, `formatCurrency`, `formatDate`, `formatTime`,
`getStatusColor`, `getStatusLabel`, `toWhatsAppPhone`, `getTimelineIcon`

---

## Complete File Inventory (What Actually Exists)

```
prisma/
├── schema.prisma          # Full schema (~1227 lines, 50+ models)
├── seed.ts                # Demo data: business, customers, pets, appointments, tasks, training
├── seed-admin.ts          # Platform admin users (superadmin, admin, owner)
└── dev.db                 # SQLite database (dev only)

public/
└── logo.svg               # Petra logo

src/
├── app/
│   ├── layout.tsx          # Root: <html lang="he" dir="rtl">, QueryProvider + AuthProvider
│   ├── page.tsx            # redirect("/dashboard")
│   ├── globals.css         # Tailwind base + custom CSS classes
│   ├── login/page.tsx      # Login page (public, no auth required)
│   ├── book/[businessId]/page.tsx  # Public multi-step booking wizard
│   ├── intake/[token]/page.tsx     # Public intake form wizard
│   ├── (dashboard)/
│   │   ├── layout.tsx           # AppShell + Suspense wrapper
│   │   ├── dashboard/page.tsx   # Stats grid, upcoming appointments, open tasks
│   │   ├── customers/page.tsx   # Customer table with search, new customer modal
│   │   ├── customers/[id]/page.tsx # Profile: contact, pets, appointments, timeline
│   │   ├── calendar/page.tsx    # Weekly grid, appointment blocks, new/edit modals
│   │   ├── tasks/page.tsx       # Task list with category/status filters, create modal
│   │   ├── leads/page.tsx       # Kanban board, stage transfer, new lead modal
│   │   ├── messages/page.tsx    # Template cards, channel filter, editor with variables
│   │   ├── boarding/page.tsx    # Room grid, stays list, check-in/out flow
│   │   ├── settings/page.tsx    # Business profile + services management tabs
│   │   ├── training/page.tsx    # Training groups + personal programs (tabs)
│   │   ├── training-groups/     # Training groups management
│   │   ├── payments/page.tsx    # Payment table, summary stats, new payment modal
│   │   ├── bookings/page.tsx    # Admin booking management with approve/decline
│   │   ├── analytics/page.tsx   # Analytics dashboard
│   │   ├── automations/         # Automation rules management
│   │   ├── availability/        # Business hours / availability management
│   │   ├── business-admin/      # Business admin panel (team, sessions, overview)
│   │   ├── exports/             # Export jobs management
│   │   ├── feeding/             # Pet feeding schedules
│   │   ├── import/              # Customer/pet bulk import
│   │   ├── intake/              # Intake form management
│   │   ├── intake-forms/        # Intake form list view
│   │   ├── invoices/            # Invoice management
│   │   ├── medications/         # Medication tracking
│   │   ├── onboarding/          # Business onboarding flow
│   │   ├── orders/              # Order management
│   │   ├── payment-request/     # Payment request flow
│   │   ├── pets/                # Pet management
│   │   ├── price-lists/         # Price list management
│   │   ├── pricing/             # Pricing management
│   │   ├── scheduled-messages/  # Scheduled message queue
│   │   ├── scheduler/           # Appointment scheduler
│   │   ├── service-dogs/        # Service dog program management
│   │   └── vaccinations/        # Vaccination tracking
│   └── api/ (197 route files)
│       ├── auth/login, logout, me, session, register, 2fa/*, google/*, forgot-password, reset-password
│       ├── dashboard, dashboard/activity, dashboard/counters
│       ├── customers, customers/[id], customers/[id]/pets, customers/[id]/timeline, customers/[id]/documents, customers/export
│       ├── appointments, appointments/[id], appointments/recurring
│       ├── services, services/[id]
│       ├── leads, leads/[id], leads/stages, leads/[id]/call-logs, leads/[id]/close-lost, leads/[id]/close-won, leads/[id]/convert, leads/[id]/logs
│       ├── messages, messages/[id], templates, scheduled-messages, scheduled-messages/[id]
│       ├── tasks, tasks/[id], tasks/[id]/audit, task-templates, task-recurrence, task-recurrence/[id]
│       ├── boarding, boarding/[id], boarding/rooms, boarding/rooms/[id], boarding/availability
│       ├── payments, payments/[id], orders, orders/[id], invoicing/*, price-lists/*, pricing/*
│       ├── training-groups, training-groups/[id]/*, training-programs, training-programs/[id]/*
│       ├── training-attendance/[id]
│       ├── pets, pets/[petId], pets/[petId]/health, pets/[petId]/behavior, pets/[petId]/medications, pets/[petId]/medications/[medId]
│       ├── pets/[petId]/attachments, pets/[petId]/documents, pets/birthdays, pets/vaccinations, pets/medications
│       ├── medications, medications/[id]
│       ├── feeding, health-alerts
│       ├── booking/book, booking/slots, booking/availability, booking/blocks, booking/bookings
│       ├── book/[slug]/*, intake, intake/[token]/*, intake/create, intake/list, intake/send
│       ├── automations, automations/[id], system-messages, system-messages/[id]
│       ├── exports, exports/download, import, import/[batchId], import/execute, import/parse, import/template
│       ├── integrations, integrations/google/*, search, analytics
│       ├── settings, account, sessions, seed
│       ├── business-admin/activity, overview, sessions, team, team/[memberId]
│       ├── admin/availability, admin/bookings, admin/users, admin/stats, admin/feed, admin/blocks, admin/[businessId]/*
│       ├── owner/audit-logs, owner/feature-flags, owner/stats, owner/tenants, owner/users
│       ├── service-dogs, service-dogs/[id]/*, service-compliance, service-placements, service-recipients
│       ├── cron/birthday-reminders, cron/generate-tasks, cron/send-reminders, cron/vaccination-reminders
│       ├── webhooks, webhooks/lead, webhooks/invoices
│       ├── onboarding, onboarding/progress, onboarding/business, onboarding/service, onboarding/client
│       └── tos/accept
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx    # Sidebar + Topbar + main content area
│   │   ├── sidebar.tsx      # Dark gradient sidebar, nav items, RTL, collapsible
│   │   └── topbar.tsx       # Search bar, page titles, user avatar
│   └── ui/                  # shadcn/ui components (button, card, dialog, etc.)
├── lib/
│   ├── prisma.ts            # PrismaClient singleton (named + default export)
│   ├── auth.ts              # Session management: create/validate/delete session, cookie helpers, getCurrentUser
│   ├── session.ts           # getSession(), getSessionByToken(), SESSION_COOKIE constant
│   ├── auth-guards.ts       # requireBusinessAuth, requireAuth, requirePlatformPermission, requirePlatformRole, requireTenantPermission, resolveSession, isGuardError, isGuardSuccess
│   ├── permissions.ts       # hasTenantPermission, hasPlatformPermission, isPlatformAdmin, TenantRole, PlatformRole
│   ├── utils.ts             # cn, DEMO_BUSINESS_ID, formatCurrency, formatDate, formatTime, etc.
│   ├── constants.ts         # TIERS, VAT_RATE, LEAD_STAGES, LEAD_SOURCES, SERVICE_TYPES, etc.
│   ├── activity-log.ts      # logCurrentUserActivity helper
│   ├── audit.ts             # logAudit — writes AuditLog records
│   ├── rate-limit.ts        # In-memory rate limiting, RATE_LIMITS presets
│   ├── slots.ts             # Booking slot availability engine
│   ├── email.ts             # Email sending via Resend
│   ├── whatsapp.ts          # WhatsApp message helpers
│   ├── intake.ts            # Intake token generation, link building, message templates
│   ├── import-utils.ts      # CSV parsing utilities for bulk import
│   ├── encryption.ts        # AES encryption for OAuth tokens
│   ├── google-calendar.ts   # GCal API: ensureUserCalendar, buildEventPayload, getValidAccessToken
│   ├── google-oauth.ts      # Google OAuth flow helpers
│   ├── sync-jobs.ts         # enqueueSyncJob — queues GCal sync operations
│   ├── invoicing/           # Invoicing provider integration (Morning API etc.)
│   ├── order-calc.ts        # Order total + VAT calculation
│   ├── rrule-utils.ts       # Recurring appointment rule parsing (rrule)
│   ├── scheduled-messages.ts # Scheduled message queue processing
│   ├── reminder-service.ts  # Appointment/vaccination reminder dispatch
│   ├── task-generator.ts    # Automatic task generation from recurrence rules
│   ├── training-groups.ts   # Training group business logic
│   ├── training-programs.ts # Training program business logic
│   ├── service-dog-engine.ts # Service dog program state machine
│   ├── service-dogs.ts      # Service dog utilities
│   ├── onboarding-state.ts  # Onboarding progress state machine
│   ├── analytics-insights.ts # Analytics computation helpers
│   ├── totp.ts              # 2FA TOTP implementation
│   └── tos.ts               # Terms of service acceptance tracking
├── middleware.ts             # Auth middleware: checks petra_session cookie, protects all routes
└── providers/
    ├── query-provider.tsx   # QueryClient with staleTime: 30s, refetchOnWindowFocus: false
    └── auth-provider.tsx    # AuthProvider with useAuth() hook, wraps layout

Config files:
├── .env                    # DATABASE_URL, Google OAuth, GCal, Resend
├── components.json         # shadcn: new-york style, lucide, CSS vars
├── next.config.mjs         # Empty config
├── postcss.config.mjs      # tailwindcss plugin
├── tailwind.config.ts      # Custom theme: brand colors, petra colors, fonts, animations
├── tsconfig.json           # @/* path alias to ./src/*
└── package.json            # All dependencies present. postcss pinned to 8.4.47
```

---

## Sidebar Navigation

| Route | Hebrew Name | Icon |
|-------|-------------|------|
| /dashboard | דשבורד | LayoutDashboard |
| /customers | לקוחות | Users |
| /calendar | יומן | Calendar |
| /tasks | משימות | ListTodo |
| /training | אימונים | GraduationCap |
| /leads | לידים | Target |
| /messages | הודעות | MessageSquare |
| /boarding | פנסיון | Hotel |
| /analytics | אנליטיקס | BarChart |
| /settings | הגדרות | Settings |

---

## Pages That EXIST with Full Implementation

### Dashboard (`/dashboard`)
- 4 stat cards: customers, today's appointments, monthly revenue, open tasks
- Upcoming appointments list (8 max, from API)
- Recent tasks list (5 max, non-completed)
- Links to /customers, /calendar, /tasks, /leads

### Customers (`/customers`)
- Searchable table with name, phone, email, pets count, appointments count
- "New Customer" modal: name*, phone*, email, tags (comma-separated), notes
- Creates timeline event on customer creation

### Customer Profile (`/customers/[id]`)
- Left column: Contact info card (phone, email, address, tags, notes)
- Right column: Pets section (grid with add modal), Appointments history (10 max), Timeline events
- Add Pet modal: name*, species (dog/cat/other), breed, gender, weight

### Calendar (`/calendar`)
- Weekly grid: Sunday-Saturday, 08:00-20:00, 64px per hour slot
- Week navigation with prev/next/today buttons
- Colored appointment blocks positioned by time
- Click grid cell → new appointment modal
- Click appointment → detail popup with complete/cancel actions
- New Appointment modal: customer*, service*, pet (optional), date*, time*, notes

### Leads (`/leads`)
- Kanban board: columns for new, contacted, qualified, won (lost hidden)
- Lead cards: name, phone, email, source badge
- Stage transfer via colored dots on hover
- New Lead modal: name*, phone, email, source, notes

### Messages (`/messages`)
- Grid of template cards with edit/delete on hover
- Channel filter tabs: all, whatsapp, SMS, email
- Editor modal: name*, channel, subject (email only), body* with variable insertion
- Available variables: {customerName}, {petName}, {date}, {time}, {serviceName}, {businessPhone}

### Tasks (`/tasks`)
- Task list with category/status filter tabs (פתוחות/הושלמו/בוטלו/הכל)
- Category filter: הכל, כללי, פנסיון, אילוף, לידים, בריאות, תרופות, האכלה
- Priority indicators (colored dots)
- New task modal

### Boarding (`/boarding`)
- Room grid showing occupancy (name, occupied/capacity)
- Stays list with pet name, customer, room, dates
- Check-in/out buttons, booking status badges
- New stay modal

### Settings (`/settings`)
- Business profile tab: name, phone, email, address
- Services management tab with list/edit

### Training (`/training`)
- Two tabs: Training Groups + Personal Programs
- Group cards with status, sessions count, participants
- Program cards with status, goals, homework

### Payments (`/payments`)
- Payment table with amount, status, method, date
- Summary stats (total, pending, paid)
- New payment modal

### Bookings (`/bookings`)
- Admin view of online bookings with approve/decline

### Analytics (`/analytics`)
- Analytics dashboard with charts and stats

### Public Pages (no auth)
- `/book/[businessId]` - Multi-step booking wizard
- `/intake/[token]` - Intake form wizard
- `/login` - Login page

---

## Known Issues

1. **PostCSS version**: Must stay pinned at `"postcss": "8.4.47"` in devDependencies. Version 8.5.x breaks Next.js 14.2.35 (ESM-only `postcss.mjs` missing CJS `postcss.js`)
2. **ts-node binary symlink**: Missing from `node_modules/.bin/`. Use `node -e "require('ts-node').register(...);"` pattern instead
3. **Missing favicon.ico**: layout.tsx references it but only logo.svg exists in public/

---

## Schema Quick Reference (Critical Fields)

### Customer
- `name` (NOT firstName/lastName!), `phone`, `phoneNorm?`, `email?`, `address?`, `notes?`, `tags` (JSON string)

### Pet
- `name`, `species` ("dog"/"cat"/"other"), `breed?`, `birthDate?`, `weight?`, `gender?`, `microchip?`
- Notes: `medicalNotes?`, `foodNotes?`, `behaviorNotes?`
- Related: `health` (DogHealth), `behavior` (DogBehavior), `medications[]` (DogMedication)

### Appointment
- `date` (DateTime), `startTime` (string "HH:mm"), `endTime` (string "HH:mm"), `status`, `notes?`, `cancellationNote?`

### Task
- Status: "OPEN" | "COMPLETED" | "CANCELED" (uppercase)
- Priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" (uppercase)
- Categories: "BOARDING" | "TRAINING" | "LEADS" | "GENERAL" | "HEALTH" | "MEDICATION" | "FEEDING"
- `dueAt?` (specific time), `dueDate?` (all-day), `completedAt?` (auto-set on completion)
- `relatedEntityType?` + `relatedEntityId?` for linking to entities

### Lead
- Stages: "new" | "contacted" | "qualified" | "won" | "lost" (lowercase in LEAD_STAGES constant)
- Lost tracking: `lostReasonCode?`, `lostReasonText?`, `lostAt?`

### TimelineEvent
- NO `title` field! Only `type`, `description`, `metadata?`
- Relation name: `timelineEvents` (not `timeline`)

### Business
- NO direct `pets` relation — access through customers
- Has `_count` for customers and appointments

---

## Conventions

1. **API Routes (authenticated)**: Use `requireBusinessAuth(request)` from `@/lib/auth-guards`. Destructure `{ businessId }` or `{ businessId, session }` from the result. NEVER hardcode `DEMO_BUSINESS_ID` in protected routes.
   ```typescript
   const authResult = await requireBusinessAuth(request);
   if (isGuardError(authResult)) return authResult;
   const { businessId } = authResult;
   ```
2. **API Routes (platform admin)**: Use `requirePlatformPermission(request, PLATFORM_PERMS.X)` for platform-level operations.
3. **API Routes (public)**: No auth guard needed. `DEMO_BUSINESS_ID` is acceptable for public booking/intake routes that operate on a single known business.
4. **Prisma**: Both `import prisma from "@/lib/prisma"` and `import { prisma } from "@/lib/prisma"` work
5. **Client Components**: Always mark with `"use client"` at top
6. **Data Fetching**: React Query `useQuery`/`useMutation` calling `fetch("/api/...")`
7. **Hebrew**: All UI text in Hebrew
8. **RTL**: `<html lang="he" dir="rtl">`, sidebar on right, content flows RTL
9. **Route Groups**: `(dashboard)` group wraps all authenticated pages in AppShell

---

## Auth Guards Reference (`src/lib/auth-guards.ts`)

| Guard | Returns | Use for |
|-------|---------|---------|
| `requireBusinessAuth(req)` | `{ session, businessId }` | Any tenant route — gets businessId from user's active membership |
| `requireAuth(req)` | `{ session }` | Session-only routes with no business context (webhooks, sessions list, etc.) |
| `requirePlatformPermission(req, perm)` | `{ session }` | Platform admin operations |
| `requirePlatformRole(req, roles[])` | `{ session }` | Platform role-gating |
| `requireTenantPermission(req, bizId, perm)` | `{ session, membership }` | Explicit business+permission check |
| `isGuardError(result)` | `boolean` | Type-narrow a guard result to NextResponse |
| `resolveSession(req)` | `FullSession \| null` | Low-level: get session without any authorization check |

---

## IDOR Security Fix (March 2026)

All 118 authenticated API routes now derive `businessId` from the user's session via `requireBusinessAuth`, preventing cross-tenant data access. `DEMO_BUSINESS_ID` is retained only in:
- **Public routes**: `booking/book`, `booking/slots`, `intake/route`
- **Platform-admin route**: `admin/availability` (uses `requirePlatformPermission`)
- **External webhook**: `webhooks/lead` (x-api-key auth)
- **GCal integration**: `integrations/route`, `integrations/google/sync` (getSession() pattern)
- **intake route**: `intake/route` — now protected with `requireBusinessAuth`

---

## .env Template

```
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."        # Required for Prisma with Neon connection pooling
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
APP_URL="http://localhost:3000"
GCAL_REDIRECT_URI="http://localhost:3000/api/integrations/google/callback"
GCAL_ENCRYPTION_KEY=""               # 32-byte hex key for OAuth token encryption
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET=""                       # Bearer token for cron routes
RESEND_API_KEY=""
EMAIL_FROM="Petra <onboarding@resend.dev>"
```

---

## Rebuild Steps (From Scratch)

1. Clone/copy the project directory
2. Install all dependencies: `PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install`
3. `npx prisma generate` to generate Prisma client
4. `npx prisma db push` to apply schema to DB
5. Run `seed.ts` then `seed-admin.ts` to populate demo data (use node -e pattern, see Database section)
6. Start dev server using the node direct command (see Dev Server section)
7. Login with `owner@petra.local` / `Admin1234!`
