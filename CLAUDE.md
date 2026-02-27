# Petra App - Complete AI Agent Rebuild Guide

## Quick Summary
**Petra** is a Hebrew/RTL pet business management SaaS app.
Target users: Dog trainers, boarding facilities, groomers in Israel.

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **UI**: Tailwind CSS + shadcn/ui (new-york style) + Heebo font
- **Database**: Prisma ORM with SQLite (dev) — schema at `prisma/schema.prisma`
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

## Key Constants
- `DEMO_BUSINESS_ID = "demo-business-001"` in `src/lib/utils.ts`
- All API routes filter by `businessId: DEMO_BUSINESS_ID`
- Auth: middleware at `src/middleware.ts` protects all routes except /login, /api/auth/*, /book, /intake
- Test accounts: `owner@petra.local` / `Admin1234!` (owner), `admin@petra.local` / `Admin1234!`, `superadmin@petra.local` / `Admin1234!`
- Business record MUST exist in DB before creating dependent records (FK constraint)

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
└── dev.db                 # SQLite database

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
│   │   ├── layout.tsx      # AppShell + Suspense wrapper
│   │   ├── page.tsx        # redirect("/dashboard")
│   │   ├── dashboard/page.tsx      # Stats grid, upcoming appointments, open tasks
│   │   ├── customers/page.tsx      # Customer table with search, new customer modal
│   │   ├── customers/[id]/page.tsx # Profile: contact, pets, appointments, timeline
│   │   ├── calendar/page.tsx       # Weekly grid, appointment blocks, new/edit modals
│   │   ├── tasks/page.tsx          # Task list with category/status filters, create modal
│   │   ├── leads/page.tsx          # Kanban board, stage transfer, new lead modal
│   │   ├── messages/page.tsx       # Template cards, channel filter, editor with variables
│   │   ├── boarding/page.tsx       # Room grid, stays list, check-in/out flow
│   │   ├── settings/page.tsx       # Business profile + services management tabs
│   │   ├── training/page.tsx       # Training groups + personal programs (tabs)
│   │   ├── payments/page.tsx       # Payment table, summary stats, new payment modal
│   │   ├── bookings/page.tsx       # Admin booking management with approve/decline
│   │   └── analytics/page.tsx      # Analytics dashboard
│   └── api/ (55 routes)
│       ├── auth/login, logout, me, session
│       ├── dashboard, customers, customers/[id], customers/[id]/pets
│       ├── appointments, appointments/[id], services, services/[id]
│       ├── leads, leads/[id], messages, messages/[id]
│       ├── boarding, boarding/[id], boarding/rooms
│       ├── tasks, tasks/[id], settings, payments, payments/[id], search
│       ├── booking/availability, booking/slots, booking/book, booking/bookings, booking/bookings/[id]
│       ├── intake/create, intake/[token], intake/[token]/submit, intake/list
│       ├── training-groups, training-groups/[id], training-groups/[id]/sessions, training-groups/[id]/participants
│       ├── training-programs, training-programs/[id], training-programs/[id]/sessions, training-programs/[id]/goals
│       ├── analytics, account, automations, exports, integrations, onboarding, seed, sessions, templates, webhooks
│       └── training/groups, training/groups/[id], training/programs, training/programs/[id]
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx    # Sidebar + Topbar + main content area
│   │   ├── sidebar.tsx      # Dark gradient sidebar, nav items, RTL, collapsible
│   │   └── topbar.tsx       # Search bar, page titles, user avatar
│   └── ui/                  # shadcn/ui components (button, card, dialog, etc.)
├── lib/
│   ├── prisma.ts            # PrismaClient singleton (named + default export)
│   ├── auth.ts              # Session management: create/validate/delete session, cookie helpers, getCurrentUser
│   ├── auth-guards.ts       # resolveSession helper for API route protection
│   ├── utils.ts             # cn, DEMO_BUSINESS_ID, formatCurrency, formatDate, formatTime, etc.
│   └── constants.ts         # TIERS, VAT_RATE, LEAD_STAGES, LEAD_SOURCES, SERVICE_TYPES, etc.
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

## All Pages Built

ALL PAGES NOW EXIST - Tasks, Boarding, Settings, Training, Payments, Bookings, Analytics, Intake all have page.tsx files.

---

## Schema Features With No Frontend Yet

- **Google Calendar Sync** (SyncJob, gcal fields on PlatformUser and Booking)
- **Billing** (PriceList, PriceListItem, Order, OrderLine)
- **Onboarding** (OnboardingProfile, OnboardingProgress)
- **Data Export** (ExportJob)
- **Automation** (AutomationRule linked to MessageTemplate)
- **System Messages** (SystemMessage)
- **Data Import** (ImportBatch, ImportRowIssue)
- **Scheduled Messages** (ScheduledMessage)

---

## Design System

### Colors (tailwind.config.ts)
- **Brand**: Orange gradient (#F97316 → #FB923C)
- **Sidebar**: Dark slate gradient (#0F172A → #1A2744)
- **Background**: #F8FAFC
- **Card**: #FFFFFF
- **Text**: #0F172A
- **Muted text**: #64748B
- **Border**: #E2E8F0

### Font
- **Heebo** (Google Fonts) loaded via `@import` in globals.css

### Custom CSS Classes (globals.css)
Cards: `.card`, `.card-hover`, `.stat-card`
Buttons: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
Badges: `.badge`, `.badge-brand`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-neutral`
Forms: `.input`, `.label`
Layout: `.page-header`, `.page-title`, `.divider`
Modal: `.modal-overlay`, `.modal-backdrop`, `.modal-content`
Table: `.table-header-cell`, `.table-cell`
Empty: `.empty-state`, `.empty-state-icon`

### Animations
`animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `animate-pulse-soft`

---

## Known Bugs (FIXED)

All previously known bugs have been fixed:
- ~~`search/route.ts` firstName/lastName~~ → uses `name` field correctly
- ~~`payments/route.ts` firstName/lastName~~ → uses `name` field correctly
- ~~`boarding/rooms/route.ts` boardingRoom~~ → uses `prisma.room` correctly
- ~~Appointment status case~~ → consistent lowercase "scheduled"

## Known Issues

1. **PostCSS version**: Must stay pinned at `"postcss": "8.4.47"` in devDependencies. Version 8.5.x breaks Next.js 14.2.35 (ESM-only `postcss.mjs` missing CJS `postcss.js`)
2. **ts-node binary symlink**: Missing from `node_modules/.bin/`. Use `node -e "require('ts-node').register(...);"` pattern instead
5. **Missing favicon.ico**: layout.tsx references it but only logo.svg exists in public/

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

1. **API Routes**: Always import `DEMO_BUSINESS_ID` from `@/lib/utils` and filter by it
2. **Prisma**: Both `import prisma from "@/lib/prisma"` and `import { prisma } from "@/lib/prisma"` work
3. **Client Components**: Always mark with `"use client"` at top
4. **Data Fetching**: React Query `useQuery`/`useMutation` calling `fetch("/api/...")`
5. **Hebrew**: All UI text in Hebrew
6. **RTL**: `<html lang="he" dir="rtl">`, sidebar on right, content flows RTL
7. **Route Groups**: `(dashboard)` group wraps all authenticated pages in AppShell

---

## .env Template

```
DATABASE_URL="file:./dev.db"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
APP_URL="http://localhost:3000"
GCAL_REDIRECT_URI="http://localhost:3000/api/integrations/google/callback"
GCAL_ENCRYPTION_KEY=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET=""
RESEND_API_KEY=""
EMAIL_FROM="Petra <onboarding@resend.dev>"
```

---

## Rebuild Steps (From Scratch)

1. Clone/copy the project directory
2. Install all dependencies (see "CRITICAL: package.json is Stripped" section above)
3. `npx prisma generate` to generate Prisma client
4. `npx prisma db push` to apply schema to SQLite
5. Run `seed.ts` then `seed-admin.ts` to populate demo data (use node -e pattern, see Database section)
6. Start dev server using the node direct command (see Dev Server section)
7. Login with `owner@petra.local` / `Admin1234!`
8. All pages and API routes should work - 28/28 verified working
