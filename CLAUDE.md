# Petra App — Complete AI Agent Reference

> Last updated: March 2026. Written by reading actual code, not guessing.

---

## 1. Project Overview

**Petra** is a Hebrew/RTL B2B SaaS platform for pet-service businesses in Israel.

**Target users:**
- Dog trainers (home visits, boarding training, group classes, service-dog programs)
- Pet boarding facilities (kennels/pensions)
- Pet groomers

**Core problem it solves:** Israeli pet professionals manage everything in WhatsApp groups, paper notebooks, and Excel. Petra centralizes clients, appointments, training programs, finances, and lead management in one RTL Hebrew interface.

**Business model:** Multi-tenant SaaS. Each business has its own isolated data. Tiers: free, basic (₪99/mo), pro (₪199/mo), groomer (₪169/mo). Tier enforcement is schema-level only — no gating logic in code yet.

---

## 2. Tech Stack

### Runtime
| Package | Purpose |
|---------|---------|
| `next` 14.2.35 | Framework (App Router, server components, API routes) |
| `react` ^18 | UI |
| `@prisma/client` ^5 | DB ORM |
| `@tanstack/react-query` ^5 | Client-side server state |
| `tailwindcss` ^3.4.1 | Styling |
| `lucide-react` ^0.400 | Icons |
| `sonner` ^2.0.7 | Toast notifications |
| `@radix-ui/*` | Headless UI primitives (dialog, dropdown, select, switch, tabs, etc.) |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Conditional class utilities |
| `@dnd-kit/core` + `/sortable` + `/utilities` | Drag-and-drop |
| `recharts` ^3.7.0 | Charts (analytics page) |
| `date-fns` ^4.1.0 | Date manipulation |
| `bcryptjs` ^2.4.3 | Password hashing |
| `resend` ^6.9.2 | Transactional email |
| `twilio` ^5.12.2 | WhatsApp/SMS messaging |
| `stripe` ^20.4.0 | Payment processing (per-business Stripe keys) |
| `xlsx` ^0.18.5 | Excel export (customer/pet data) |
| `qrcode` ^1.5.4 | Service dog ID card QR codes |
| `zod` ^3.25.76 | Runtime schema validation (sparse — not used everywhere) |
| `@vercel/blob` ^2.3.1 | File storage |

### Dev
| Package | Purpose |
|---------|---------|
| `prisma` ^5 | Schema + migrations CLI |
| `ts-node` ^10 | Seed scripts |
| `typescript` ^5 | Type checking |
| `postcss` 8.4.47 | **PINNED** — 8.5.x breaks Next.js 14 |
| `tailwindcss-animate` ^1 | Tailwind animation utilities |
| `eslint` + `eslint-config-next` | Linting |

### Services
| Service | Use |
|---------|-----|
| **Supabase** (PostgreSQL) | Production database (transaction pooler port 6543, direct port 5432) |
| **Vercel** | Hosting + edge functions |
| **Resend** | Email delivery (password reset, reminders) |
| **Twilio** | WhatsApp messages (booking confirmations, reminders) |
| **Google OAuth + Calendar** | Login with Google + GCal sync for bookings |
| **Morning (Green Invoice)** | Israeli invoice/receipt issuance integration |
| **Stripe** | Online payment collection |
| **Make.com** | Webhook automation (lead ingestion from website forms) |
| **Vercel Blob** | File uploads |

---

## 3. Folder Structure

```
petra-app/
├── prisma/
│   ├── schema.prisma              # Dev schema (SQLite/PostgreSQL)
│   ├── schema.production.prisma   # Production schema (PostgreSQL, used by Vercel)
│   ├── seed.ts                    # Demo data (business, customers, pets, appointments…)
│   ├── seed-admin.ts              # Platform admin users (owner, admin, superAdmin)
│   ├── seed-service-dogs.ts       # Service dog demo data
│   └── dev.db                     # SQLite file (dev only)
│
├── public/
│   └── logo.svg
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout: <html lang="he" dir="rtl">, QueryProvider + AuthProvider
│   │   ├── page.tsx               # Redirects to /dashboard
│   │   ├── globals.css            # Tailwind + custom CSS classes (.btn-primary, .input, .card, etc.)
│   │   │
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── onboarding/page.tsx    # Post-registration personalization wizard
│   │   ├── privacy/page.tsx       # Privacy policy (static)
│   │   ├── tos-accept/page.tsx    # ToS acceptance gate
│   │   │
│   │   ├── book/[businessId]/     # Public: multi-step booking wizard
│   │   ├── intake/[token]/        # Public: pet intake form (sent via WhatsApp)
│   │   ├── my-booking/[token]/    # Public: customer self-service booking view
│   │   │
│   │   ├── (dashboard)/           # Auth-gated pages (wrapped in AppShell)
│   │   │   ├── layout.tsx         # AppShell + Toaster
│   │   │   ├── dashboard/         # Stats, upcoming appointments, open tasks
│   │   │   ├── customers/         # List + [id] profile
│   │   │   ├── calendar/          # Weekly grid calendar
│   │   │   ├── tasks/             # Task list with filters
│   │   │   ├── leads/             # Kanban CRM
│   │   │   ├── messages/          # Message template editor
│   │   │   ├── boarding/          # Room grid + stays
│   │   │   ├── training/          # All training (7 tabs — see Training section)
│   │   │   ├── training-groups/   # Group training management
│   │   │   ├── service-dogs/      # Service dog program (6 sub-pages)
│   │   │   ├── payments/          # Payment table + summary
│   │   │   ├── orders/            # Order list + [id] detail
│   │   │   ├── invoices/          # Invoice document viewer
│   │   │   ├── price-lists/       # Price list management
│   │   │   ├── pricing/           # Services + PriceListItem CRUD
│   │   │   ├── analytics/         # Charts and stats (recharts)
│   │   │   ├── settings/          # Business profile + services tabs
│   │   │   ├── bookings/          # Admin approval queue for online bookings
│   │   │   ├── scheduler/         # Appointment scheduler view
│   │   │   ├── payment-request/   # Send payment link to customer
│   │   │   ├── automations/       # Automation rule CRUD
│   │   │   ├── scheduled-messages/# Scheduled message queue
│   │   │   ├── intake-forms/      # Intake form admin list
│   │   │   ├── intake/            # Dashboard intake view (⚠️ accessible without auth via middleware bug)
│   │   │   ├── exports/           # Data export (XLSX/CSV)
│   │   │   ├── import/            # Bulk customer/pet import
│   │   │   ├── feeding/           # Pet feeding schedules (boarding)
│   │   │   ├── medications/       # Medication tracking
│   │   │   ├── vaccinations/      # Vaccination tracking
│   │   │   ├── pets/              # Pet management list + [id]
│   │   │   ├── availability/      # Business hours configuration
│   │   │   ├── business-admin/    # Team + session management
│   │   │   └── (owner + admin subdirs for platform admin)
│   │   │
│   │   └── api/                   # ~60 route directories, ~197 route files
│   │       (see API Routes section)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── app-shell.tsx      # Sidebar + topbar + main content wrapper
│   │   │   ├── sidebar.tsx        # Dark gradient RTL sidebar, accordion groups
│   │   │   ├── topbar.tsx         # Search, page title, user avatar
│   │   │   ├── NotificationBell.tsx
│   │   │   ├── SystemInbox.tsx
│   │   │   └── mobile-bottom-nav.tsx
│   │   └── ui/                    # shadcn/ui components (button, card, dialog, input, etc.)
│   │   └── (feature-specific component folders)
│   │       ├── admin/             # Platform admin shell
│   │       ├── analytics/         # Analytics charts
│   │       ├── boarding/          # BoardingTabs
│   │       ├── finance/           # FinanceTabs
│   │       ├── service-dogs/      # ServiceDogsTabs
│   │       ├── tenant-admin/      # Tenant admin components
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── prisma.ts              # PrismaClient singleton (named + default export)
│   │   ├── auth.ts                # createSession, validateSession, deleteSession
│   │   ├── session.ts             # getSession(), SESSION_COOKIE constant
│   │   ├── auth-guards.ts         # requireBusinessAuth, requireAuth, requirePlatformPermission, etc.
│   │   ├── permissions.ts         # hasTenantPermission, hasPlatformPermission, role constants
│   │   ├── utils.ts               # cn, DEMO_BUSINESS_ID, formatCurrency, formatDate, formatTime, etc.
│   │   ├── constants.ts           # TIERS, VAT_RATE, LEAD_STAGES, LEAD_SOURCES, SERVICE_TYPES
│   │   ├── rate-limit.ts          # In-memory rate limiter (API_WRITE: 120/min, LOGIN: 10/min)
│   │   ├── activity-log.ts        # logCurrentUserActivity() — business action log
│   │   ├── audit.ts               # logAudit() — platform action audit trail
│   │   ├── email.ts               # sendEmail() via Resend
│   │   ├── whatsapp.ts            # sendWhatsAppMessage() via Twilio
│   │   ├── intake.ts              # Intake token generation + link building
│   │   ├── slots.ts               # Booking slot availability engine
│   │   ├── rrule-utils.ts         # Recurring appointment rule parsing
│   │   ├── scheduled-messages.ts  # Scheduled message queue processing
│   │   ├── reminder-service.ts    # Appointment/vaccination reminder dispatch
│   │   ├── task-generator.ts      # Auto task generation from recurrence rules
│   │   ├── training-groups.ts     # Training group business logic
│   │   ├── training-programs.ts   # Training program business logic
│   │   ├── service-dog-engine.ts  # Service dog phase state machine
│   │   ├── service-dogs.ts        # Service dog utils + DISABILITY_TYPES constant
│   │   ├── order-calc.ts          # Order total + VAT calculation
│   │   ├── import-utils.ts        # CSV parsing for bulk import
│   │   ├── encryption.ts          # AES-256-GCM for OAuth/API token storage
│   │   ├── google-calendar.ts     # GCal API: ensureUserCalendar, buildEventPayload
│   │   ├── google-oauth.ts        # Google OAuth flow helpers
│   │   ├── sync-jobs.ts           # enqueueSyncJob for GCal background sync
│   │   ├── onboarding-state.ts    # Onboarding progress state machine
│   │   ├── analytics-insights.ts  # Analytics computation helpers
│   │   ├── totp.ts                # 2FA TOTP implementation
│   │   ├── tos.ts                 # Terms of service acceptance tracking
│   │   ├── stripe.ts              # Stripe helpers
│   │   ├── onboard-user.ts        # User onboarding flow helper
│   │   ├── onboarding-analytics.ts
│   │   └── invoicing/             # Morning (Green Invoice) API integration
│   │
│   ├── middleware.ts              # Auth gate: checks petra_session cookie
│   └── providers/
│       ├── query-provider.tsx     # React Query setup (staleTime: 30s)
│       └── auth-provider.tsx      # AuthProvider + useAuth() hook
│
├── .env                           # Local env vars (DATABASE_URL, secrets)
├── vercel.json                    # Vercel deployment config
├── next.config.mjs                # poweredByHeader: false, serverComponentsExternalPackages
├── tailwind.config.ts             # Custom brand colors, Heebo font, animations
├── tsconfig.json                  # @/* → ./src/* path alias
├── components.json                # shadcn: new-york style, lucide icons
└── postcss.config.mjs             # tailwindcss plugin
```

---

## 4. Database Schema

**50+ Prisma models.** Database: PostgreSQL (Supabase in production, schema at `prisma/schema.prisma`).

### Platform / Auth
| Model | Purpose |
|-------|---------|
| `PlatformUser` | Global user. Has email, passwordHash, googleId, 2FA fields, GCal OAuth tokens, platformRole |
| `BusinessUser` | Many-to-many: links PlatformUser ↔ Business with a role (owner/manager/user) |
| `AdminSession` | Server-side session (token stored as cookie `petra_session`, 7-day expiry) |
| `PasswordResetToken` | Single-use, 1-hour expiry reset tokens |
| `AuditLog` | Full audit trail for privileged platform actions |
| `ActivityLog` | Privacy-safe action log (action type + timestamp only, no customer data) |
| `FeatureFlag` | Platform-level feature flags |
| `IpWhitelist` | IP whitelist for platform admin accounts |
| `UserConsent` | Legal evidence of ToS acceptance |

### Business / Tenant
| Model | Purpose |
|-------|---------|
| `Business` | Tenant root. Has slug, tier, boarding config, booking config, webhookApiKey |
| `User` | Legacy per-tenant staff model (kept for backwards compat) |
| `Customer` | name, phone, email, address, notes, tags (JSON), documents (JSON) |
| `Pet` | Belongs to Customer (customerId optional — standalone service dogs have businessId instead) |
| `Service` | Bookable services with duration, price, online booking config |
| `Appointment` | date, startTime/endTime (string HH:mm), status, links to customer/pet/service |

### Boarding
| Model | Purpose |
|-------|---------|
| `BoardingStay` | checkIn, checkOut, status, room, links to pet+customer |
| `Room` | name, capacity, type, pricePerNight, sortOrder |
| `BoardingCareLog` | FEEDING/MEDICATION/WALK/NOTE log entries per stay |

### CRM / Leads
| Model | Purpose |
|-------|---------|
| `Lead` | name, phone, source, stage (string UUID), won/lost tracking, follow-up fields |
| `LeadStage` | Per-business custom stages (name, color, sortOrder, isWon, isLost) |
| `CallLog` | Linked to Lead — summary + treatment notes |
| `TimelineEvent` | Customer activity timeline (type + description, NO title field) |

### Payments / Finance
| Model | Purpose |
|-------|---------|
| `Payment` | amount, method, status, links to appointment/boardingStay/order/customer |
| `PriceList` | Container for price list items |
| `PriceListItem` | name, basePrice, unit, sessions (for packages), isBookableOnline |
| `Order` | Aggregated purchase: lines, discount, tax, total |
| `OrderLine` | Single line in an order |
| `InvoicingSettings` | Per-business Morning (Green Invoice) API credentials (encrypted) |
| `InvoiceJob` | Retry queue for invoice issuance |
| `InvoiceDocument` | Issued invoices/receipts (docType: 305/320/330/400) |
| `InvoiceWebhookLog` | Incoming webhook audit |
| `StripeSettings` | Per-business Stripe keys (encrypted), currency |

### Messaging
| Model | Purpose |
|-------|---------|
| `MessageTemplate` | WhatsApp/SMS/email templates with variable interpolation |
| `AutomationRule` | Trigger-based auto-send rules (uses MessageTemplate) |
| `ScheduledMessage` | Queue of messages to be sent at a future time |
| `SystemMessage` | In-app notification messages per business |

### Tasks
| Model | Purpose |
|-------|---------|
| `Task` | title, category (BOARDING/TRAINING/LEADS/GENERAL/HEALTH/MEDICATION/FEEDING), priority, status, dueAt/dueDate |
| `TaskTemplate` | Reusable task templates |
| `TaskRecurrenceRule` | rrule-based auto-task generation |
| `TaskAuditLog` | Audit trail per task |

### Training
| Model | Purpose |
|-------|---------|
| `TrainingProgram` | Per-dog training program. trainingType: HOME/BOARDING/SERVICE_DOG. Links to Package, Order, PriceListItem |
| `TrainingGoal` | Goals within a program (status: NOT_STARTED/IN_PROGRESS/ACHIEVED/DROPPED) |
| `TrainingProgramSession` | Individual sessions (practiceItems, nextSessionGoals, homeworkForCustomer) |
| `TrainingHomework` | Homework assigned between sessions |
| `TrainingPackage` | Sellable packages (type: HOME/BOARDING/GROUP/WORKSHOP, sessions count, price) |
| `TrainingGroup` | Group class or workshop |
| `TrainingGroupSession` | Single session within a group |
| `TrainingGroupParticipant` | Dog+customer enrolled in a group |
| `TrainingGroupAttendance` | Per-session attendance record |

### Service Dogs
| Model | Purpose |
|-------|---------|
| `ServiceDogProfile` | 1:1 extension of Pet. phase (SELECTION→TRAINING→ADVANCED→PLACEMENT→CERTIFIED→RETIRED), certificationDate, trainingHours |
| `ServiceDogRecipient` | Person receiving a service dog (disability info, waitlist status) |
| `ServiceDogPlacement` | Dog↔Recipient match (PENDING/TRIAL/ACTIVE/TERMINATED) |
| `ServiceDogMedicalProtocol` | Phase-based medical requirements with due dates |
| `ServiceDogTrainingLog` | ADI training session logs with cumulative hours |
| `ServiceDogComplianceEvent` | 48-hour government notification events |
| `ServiceDogIDCard` | Digital ID card with QR token (public endpoint to verify) |

### Online Booking
| Model | Purpose |
|-------|---------|
| `AvailabilityRule` | Working hours per day of week |
| `AvailabilityBlock` | Manual time-off blocks |
| `AvailabilityBreak` | Daily break windows (lunch, prayer, etc.) |
| `Booking` | Public-facing online booking (separate from Appointment). Has gcalSyncStatus, customerToken |
| `BookingDog` | Junction: which dogs are in a booking |
| `SyncJob` | Background GCal sync queue |

### Intake / Onboarding / Other
| Model | Purpose |
|-------|---------|
| `IntakeForm` | Token-based form sent via WhatsApp to capture pet/health info |
| `DogHealth` | Detailed vaccination/medical history (1:1 with Pet) |
| `DogBehavior` | Behavioral traits + issues (all boolean flags + text fields) |
| `DogMedication` | Medication rows per pet |
| `ImportBatch` | Tracks bulk CSV import jobs |
| `ImportRowIssue` | Per-row validation errors from import |
| `ExportJob` | Tracks XLSX/CSV export generation jobs |
| `AnalyticsEvent` | Append-only event log for analytics |
| `OnboardingProfile` | Personalization answers (business type, size, goal) |
| `OnboardingProgress` | Which onboarding steps are completed |

---

## 5. Environment Variables

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://..."        # Transaction pooler (port 6543)
DIRECT_URL="postgresql://..."          # Direct/session pooler (port 5432) — for Prisma migrations

# Google OAuth (login with Google)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"

# Google Calendar Sync
GCAL_REDIRECT_URI="http://localhost:3000/api/integrations/google/callback"
GCAL_ENCRYPTION_KEY=""    # 32-byte hex: openssl rand -hex 32

# App URLs
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cron job auth
CRON_SECRET=""             # Bearer token for /api/cron/* endpoints

# Invoicing (Morning / Green Invoice)
INVOICING_ENCRYPTION_KEY=""   # 32-byte hex

# Stripe
STRIPE_ENCRYPTION_KEY=""      # 32-byte hex

# Email (Resend)
RESEND_API_KEY=""
EMAIL_FROM="Petra <onboarding@resend.dev>"

# WhatsApp / SMS (Twilio)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_FROM="+14155238886"   # sandbox or approved number

# Webhooks
MAKE_WEBHOOK_SECRET=""         # Secret for Make.com webhook auth
WEBHOOK_BUSINESS_ID=""         # Default business for lead webhook

# Vercel Blob
BLOB_READ_WRITE_TOKEN=""
```

### Typed server-side access (`src/lib/env.ts`)

Use `env.ts` instead of `process.env` directly in any server-side code:

```typescript
import { env, isDev, isProd, isStaging } from "@/lib/env";

env.APP_URL          // typed string, defaults to "http://localhost:3000"
env.DATABASE_URL     // required — throws at startup if missing
isDev                // true on localhost
isStaging            // true on Vercel preview of "staging" branch
isProd               // true on Vercel production (main branch)
```

- `DATABASE_URL` and `DIRECT_URL` are **required** — missing → throw at startup
- All other vars are optional with sensible defaults
- **Never import `env.ts` from a Client Component** — it throws at runtime if bundled for the browser
- For client-side values: use `process.env.NEXT_PUBLIC_*` directly

---

## 6. Feature Map

### ✅ Dashboard
- 4 stat cards (customers, today's appointments, monthly revenue, open tasks)
- Upcoming appointments list (next 8)
- Open tasks list (5 most recent)
- Quick-links to key sections

### ✅ Customers (`/customers`, `/customers/[id]`)
- Searchable table, new customer modal
- Profile: contact info, pet grid, appointment history, timeline events
- Pet CRUD: add/edit/delete pet (basic info, medical notes, food notes, behavior notes)
- Per-pet: DogHealth edit, DogBehavior edit, DogMedication CRUD
- CSV export (UTF-8 BOM), customer delete
- Timeline events auto-created on customer creation, appointment booking

### ✅ Calendar (`/calendar`)
- Weekly grid (Sun–Sat, 08:00–20:00, 64px/hour)
- Click cell → new appointment modal
- Click appointment → detail popup with complete/cancel
- Cancel with confirmation UI (inline, no browser confirm())
- Week navigation (prev/next/today)

### ✅ Tasks (`/tasks`)
- Filterable list: status tabs (open/completed/canceled/all) + category filter
- Priority color indicators
- New task modal, mark complete, cancel

### ✅ Leads (`/leads`)
- Kanban board with custom per-business stages
- Lead cards: name, phone, source badge
- Stage drag (colored dots) or dropdown
- New lead modal, call log, close won/lost with reason codes
- Convert lead to customer

### ✅ Messages (`/messages`)
- Template cards grid with channel filter (all/whatsapp/sms/email)
- Create/edit/delete templates
- Variable insertion: {customerName}, {petName}, {date}, {time}, {serviceName}, {businessPhone}

### ✅ Boarding (`/boarding`)
- Room grid with occupancy visualization
- Stay list with check-in/out buttons
- New stay modal, status badges
- Room CRUD (in settings)

### ✅ Boarding Care Logs
- FEEDING/MEDICATION/WALK/NOTE log entries per stay
- API: `/api/boarding/[id]/care-logs`

### ✅ Training — Full Module (`/training`)
7 tabs total:

| Tab | What it shows |
|-----|--------------|
| **סקירה** (Overview) | Active dogs grid, alerts (≤2 sessions remaining, 14+ days gap), WhatsApp button |
| **אילוף פרטני** | Home training programs. Package/session management, goals, sessions, homework |
| **אילוף בפנסיון** | Boarding training programs. Weekly update modal with home sessions |
| **קבוצות** | Training groups + workshops (merged sub-tab) |
| **כלבי שירות** | Service dog training programs. Phase display, "הוסף כלב שירות" + "הוסף זכאי" buttons |
| **חבילות** | TrainingPackage CRUD (type, sessions, price) |
| **ארכיון** | Completed/canceled programs with date filter + CSV export |

- SessionLogModal: practiceItems, nextSessionGoals, homeworkForCustomer; `isWeekly` prop for boarding context
- Auto-complete program when all planned sessions done
- Finish/dropout buttons
- Program settings modal (goals, homework)

### ✅ Service Dogs — Full Module (`/service-dogs/*`)
6 sub-pages:

| Page | Purpose |
|------|---------|
| `/service-dogs` | Overview dashboard: counts by phase, recent activity |
| `/service-dogs/dogs` | Dog card grid with phase filter |
| `/service-dogs/[id]` | Individual dog profile (training, medical, compliance, placements, ID card tabs) |
| `/service-dogs/recipients` | Recipient table + detail modal |
| `/service-dogs/placements` | Placements list + active placement highlight |
| `/service-dogs/compliance` | Compliance events + urgency grouping |
| `/service-dogs/id-cards` | ID card grid + QR code viewer |

- Public endpoint: `/api/service-dogs/id-card/[token]` — no auth, verifies QR
- Standalone service dogs: Pet created without Customer (businessId set directly)

### ✅ Payments (`/payments`)
- Payment table with amount, status, method, date
- Summary stats (total paid, pending, this month)
- New payment modal linked to customer/order

### ✅ Orders (`/orders`, `/orders/[id]`)
- Order list with status filter
- Order detail: line items, discount, tax, total
- Order creation modal with training sub-types (מפגש/חבילה/פנסיון/קבוצתי)

### ✅ Invoicing (`/invoices`)
- Invoice document list
- Integration with Morning (Green Invoice) API
- Issue receipts/invoices for payments
- Webhook receipt (with HMAC verification)

### ✅ Analytics (`/analytics`)
- Charts: appointments over time, revenue, customer acquisition
- Stats: averages, totals, period comparison

### ✅ Settings (`/settings`)
- Business profile (name, phone, email, address, VAT, logo)
- Services tab (CRUD)
- Data tab (export XLSX/CSV for customers + pets)
- Logo URL with live 32×32 preview
- Booking page URL with copy button

### ✅ Pricing (`/pricing`)
- Services tab: service CRUD
- "פריטי חיוב" (billing items) tab: PriceListItem CRUD
  - Fields: name, category, basePrice, unit, paymentUrl, taxMode, sessions (packages)
  - Soft-delete with re-activate toggle

### ✅ Price Lists (`/price-lists`)
- PriceList container management

### ✅ Scheduler (`/scheduler`)
- Appointment scheduler view (calendar-style)

### ✅ Payment Request (`/payment-request`)
- Send payment link to customer
- Auto-selects customer from `?customerId` URL param

### ✅ Online Booking System
- Public wizard: `/book/[businessId]` (multi-step)
- Service selection, date/time picker, customer info, confirmation
- Availability engine: rules + blocks + breaks + existing appointments
- Booking approval queue for businesses using "requires_approval" mode
- WhatsApp confirmation to customer + business on booking
- GCal sync for confirmed bookings

### ✅ Intake Forms
- Admin: `/intake-forms` — list + status tracking
- Public: `/intake/[token]` — pet health/behavior questionnaire
- API creates/updates DogHealth, DogBehavior, DogMedication on submit

### ✅ Automations (`/automations`)
- AutomationRule CRUD (trigger + template + active toggle)

### ✅ Scheduled Messages (`/scheduled-messages`)
- Queue viewer + cancel

### ✅ Exports (`/exports`)
- Export customers/pets as XLSX or CSV
- `/api/customers/export` — quick CSV download

### ✅ Bulk Import (`/import`)
- CSV template download
- Batch parse + preview + execute
- Rollback within deadline

### ✅ Feeding (`/feeding`)
- Per-pet feeding schedule for boarding pets

### ✅ Medications (`/medications`)
- Medication tracking for boarding pets

### ✅ Vaccinations (`/vaccinations`)
- Vaccination due-date tracking

### ✅ Pets (`/pets`, `/pets/[id]`)
- Pet management independent of customer profile

### ✅ Business Admin (`/business-admin`)
- Team management (BusinessUser CRUD)
- Active sessions list
- Business overview stats

### ✅ Availability (`/availability`)
- Business hours per day of week
- Manual blocks (vacations)
- Break windows (lunch, prayer)

### ✅ Bookings Admin (`/bookings`)
- Incoming online booking approval/decline queue

### ✅ Auth
- Email + password login
- Google OAuth login
- 2FA (TOTP with backup codes)
- Password reset via email (Resend)
- Session management (7-day cookie)

### ✅ Platform Admin (Owner/Admin)
- `/owner/*` — platform-wide stats, audit logs, tenant management, feature flags, user list
- `/admin/*` — business admin, booking queue, availability, user management

### 🔄 Notifications / System Inbox
- `NotificationBell.tsx` + `SystemInbox.tsx` components exist in layout
- SystemMessage model exists + API routes
- **Missing:** actual notification trigger logic (messages written manually via API, no auto-create hooks)

### 🔄 Google Calendar Sync
- OAuth connect flow built (`/api/integrations/google/*`)
- `SyncJob` model + queue built
- `sync-jobs.ts` enqueueSyncJob built
- **Missing:** background worker to process jobs (needs cron or Vercel edge function)
- Settings UI for GCal connection exists

### 🔄 Stripe Payments
- `StripeSettings` model + encrypted key storage
- `stripe.ts` lib exists
- `StripeSettings` CRUD in settings
- **Missing:** actual checkout session creation, payment confirmation webhook handling is basic

### 🔄 Reminders / Cron
- Cron routes exist: `/api/cron/birthday-reminders`, `/api/cron/generate-tasks`, `/api/cron/send-reminders`, `/api/cron/vaccination-reminders`
- `reminder-service.ts` built
- **Missing:** cron jobs registered on Vercel — not configured in `vercel.json`

### 🔄 Onboarding
- `OnboardingProfile` + `OnboardingProgress` models exist
- `/onboarding` page exists
- **Status:** partial — post-registration flow exists but may not be fully wired to new signups

### ❌ Multi-currency / International
- Schema has currency field on PriceList, StripeSettings
- All UI is ILS/₪ hardcoded, no switching

### ❌ Mobile App
- RTL mobile layout partially handled (`mobile-bottom-nav.tsx` exists)
- Not a native app, PWA not configured

### ❌ Tier Enforcement
- TIERS constant defined in constants.ts
- No actual feature gating in code based on tier

---

## 7. Planned Features & Roadmap

Based on code comments, schema fields, and incomplete implementations:

1. **Cron jobs (Vercel)** — birthday reminders, send-reminders, vaccination alerts, auto task generation are coded but not scheduled
2. **GCal sync worker** — SyncJob queue exists but processing never runs automatically
3. **Stripe checkout** — keys stored, but no checkout flow for customers
4. **Tier gating** — schema has `tier` on Business, TIERS constant defined, but zero enforcement
5. **WhatsApp API messages** — Twilio integration built, but some automation rules may fail silently without RESEND_API_KEY / Twilio credentials
6. **Boarding care log UI** — Model + API exists, but no dedicated UI page surfacing it per stay
7. **Group training attendance** — Full schema exists (TrainingGroupAttendance), attendance marking API at `/api/training-attendance/[id]`, UI partial
8. **Notification center** — SystemMessage model + API exist, NotificationBell in topbar, but auto-creation of notifications (e.g., "new booking received") not wired
9. **Task template recurrence** — Full model + generator service built, but UI to manage recurrence rules is minimal

---

## 8. Current Status (March 2026)

**Most active area:** Training module (March 2026 complete overhaul).

Recent git history (most recent first):
- `eaa85db` — Rate limiting, goal invalidation fixes, WhatsApp booking confirmations
- `f39011f` — Standalone service dog auto-creates TrainingProgram + adds "הוסף זכאי" to training tab
- `ac7fe47` — Null-guard fixes for Pet.customer after making customerId optional
- `5fd07b6` — Null-safe customer access, boarding tab RTL redesign
- `9d4c89d` — **Standalone service dogs** (Pet.customerId now optional, new API `/api/service-dogs/standalone-pet`)
- `41ba743` — Weekly update modal: unrestricted date + home sessions section
- `594d6bc` — Training-order deep sync (goals, order link, programType)
- `9dcc54b` — CreateOrderModal: boarding + group training sub-types
- `c5607a6` — Boarding weekly update modal: SessionLogModal with `isWeekly: true`
- `4f69fba` — Boarding training: weekly updates flow + auto-create HOME follow-up program
- `3341c97` — Service dog phase selector in training tab
- `6611027` — Training archive date range filter

**Production deployment:** Vercel, auto-deploys from `main` branch push. Schema at `prisma/schema.production.prisma` (must stay in sync with `prisma/schema.prisma`).

---

## 9. Key Conventions

### Auth in API routes
```typescript
// ALL protected API routes must use this pattern:
const authResult = await requireBusinessAuth(request);
if (isGuardError(authResult)) return authResult;
const { businessId } = authResult;
// NEVER hardcode DEMO_BUSINESS_ID in protected routes
```

### Public routes only (booking, intake, webhooks)
```typescript
// Acceptable to use DEMO_BUSINESS_ID only in:
// - /api/booking/book, /api/booking/slots (public booking)
// - /api/webhooks/lead (x-api-key auth, uses WEBHOOK_BUSINESS_ID env var)
// - /api/service-dogs/id-card/[token] (public QR verification)
```

### React Query pattern
```typescript
const { data, isLoading, isError } = useQuery({
  queryKey: ["customers"],
  queryFn: () => fetch("/api/customers").then(r => r.json()),
});
const mutation = useMutation({
  mutationFn: (data) => fetch("/api/customers", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); toast.success("..."); },
  onError: () => toast.error("..."),
});
```

### Toast notifications
```typescript
import { toast } from "sonner";
// <Toaster> is in src/app/(dashboard)/layout.tsx
toast.success("לקוח נוסף בהצלחה");
toast.error("שגיאה בשמירה");
```

### File naming
- Pages: `page.tsx` (Next.js App Router)
- API routes: `route.ts`
- Client components: `"use client"` at top of file
- All UI text in Hebrew

### CSS utilities
- Tailwind classes only
- Custom class aliases in `globals.css`: `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.card`, `.modal-overlay`, `.modal-backdrop`, `.modal-content`
- RTL handled by `<html dir="rtl">` — flex/grid layouts RTL automatically

### Schema access
```typescript
// Both patterns work:
import prisma from "@/lib/prisma"
import { prisma } from "@/lib/prisma"
```

### TimelineEvent
```typescript
// NO 'title' field! Use type + description only:
await prisma.timelineEvent.create({
  data: { type: "CUSTOMER_CREATED", description: "לקוח חדש נוצר", businessId, customerId }
});
// Relation is 'timelineEvents' (not 'timeline')
```

### Lead stages
```typescript
// Stages are UUID strings from LeadStage table — NOT hardcoded "new"/"contacted"
// Always query LeadStage to get stage IDs
const stages = await prisma.leadStage.findMany({ where: { businessId } });
```

### Section tab navigation pattern
```tsx
// Add as FIRST element inside page's root <div>
// Pattern: bg-slate-100 container, bg-white shadow-sm for active tab
<div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
  <Link href="/pricing" className={cn("tab", pathname === "/pricing" ? "active" : "inactive")}>
    שירותים
  </Link>
</div>
```

---

## 10. Important Rules — Do Not Break

### 1. PostCSS version
`"postcss": "8.4.47"` in devDependencies — **NEVER update this**. Version 8.5.x breaks Next.js 14.2.x (ESM-only module missing CJS entry point).

### 2. Production schema sync
After EVERY schema change to `prisma/schema.prisma`:
```bash
cp prisma/schema.prisma prisma/schema.production.prisma
git add prisma/schema.production.prisma
git commit -m "fix: sync production schema"
git push origin main
```
Vercel runs `prisma generate --schema=prisma/schema.production.prisma`. A stale production schema causes TypeScript compile errors and deployment failure.

### 3. DEMO_BUSINESS_ID
Only use `DEMO_BUSINESS_ID` in:
- Public booking routes (`/api/booking/*`)
- Seed scripts
- Platform admin routes that explicitly need it
**Never in authenticated tenant routes.**

### 4. Pet.customerId is nullable
As of March 2026, `Pet.customerId` is `String?`. Always use optional chaining:
```typescript
pet.customer?.name ?? ""
pet.customer?.id ?? null
```

### 5. Node.js PATH
Node v20.11.1 is at `/Users/or-rabinovich/local/node/bin/` — not in PATH. Always prefix:
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate
```

### 6. `shadcn init` destroys utils.ts
Running `npx shadcn init` replaces `src/lib/utils.ts` with just `cn`. Restore:
`DEMO_BUSINESS_ID`, `formatCurrency`, `formatDate`, `formatTime`, `getStatusColor`, `getStatusLabel`, `toWhatsAppPhone`, `getTimelineIcon`

### 7. Sidebar overflow fix
When sidebar overflows viewport: accordion behavior in `useEffect` watching `pathname` — close all other groups, keep only active group open. Location: `src/components/layout/sidebar.tsx`.

### 8. Middleware: intake page bug
`/intake` (dashboard admin page) is accessible without auth because `/intake/[token]` is in PUBLIC_PATHS as a prefix match. Do not add `/intake` to PUBLIC_PATHS — fix by using exact-path check.

### 9. DogBehavior.fears
`fears` is `Boolean` — not a string array. Old code had this wrong.

### 10. IDOR security
All 118 authenticated API routes derive `businessId` from session via `requireBusinessAuth`. Do not use request body/params for businessId in protected routes.

---

## 11. How to Run

### Development
```bash
# Install dependencies
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install

# Generate Prisma client
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate

# Apply schema to DB
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma db push

# Seed demo data
node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed.ts')"
node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed-admin.ts')"

# Start dev server (must use this command — Hebrew path breaks npm run dev)
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'; node node_modules/.bin/next dev) > /tmp/petra-dev.log 2>&1 &
```

### TypeScript check
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

### Production build (simulate Vercel)
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate --schema=prisma/schema.production.prisma && node node_modules/.bin/next build
```

### Deploy to Vercel
```bash
bash -c 'cd $'"'"'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'"'"' && vercel --prod'
# OR simply push to main — Vercel auto-deploys
git push origin main
```

### Test accounts (after seeding)
| Email | Password | Role |
|-------|----------|------|
| `owner@petra.local` | `Admin1234!` | Business owner |
| `admin@petra.local` | `Admin1234!` | Business admin |
| `superadmin@petra.local` | `Admin1234!` | Platform super admin |

### DB queries (no psql — use Prisma in node)
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.business.findMany().then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"
```

---

## 12. Production Environment

### Business accounts (Supabase DB)
| Email | businessId | Business Name |
|-------|-----------|---------------|
| `alldogneed@gmail.com` | `6c51668f-00e9-46b1-9ba2-ff113831a172` | העסק של אור רבינוביץ (PRIMARY) |
| `or.rabinovich@gmail.com` | `4c0cd6b3-c7a5-4c29-b8f4-1213ede4b893` | אור רבינוביץ׳ |

### Key production URLs
- App: `https://petra-app.com` (or Vercel domain)
- Webhook (Make.com): `https://petra-app.com/api/webhooks/lead`
- Public booking: `https://petra-app.com/book/[slug]`

### Vercel env vars required
`DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GCAL_ENCRYPTION_KEY`, `INVOICING_ENCRYPTION_KEY`, `STRIPE_ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `MAKE_WEBHOOK_SECRET`, `WEBHOOK_BUSINESS_ID`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_URL`

---

## 13. Open Questions & Unresolved Decisions

1. **Cron jobs not scheduled**: Birthday reminders, send-reminders, vaccination reminders, and task generation are fully coded but never triggered. Need to add cron config to `vercel.json` or use Vercel Cron.

2. **GCal sync worker**: SyncJob queue is built and jobs are enqueued, but nothing processes them. The `/api/integrations/google/process-jobs` endpoint exists but isn't called on a schedule.

3. **`/intake` accessible without auth**: The dashboard admin page at `/intake` is publicly accessible because the middleware uses prefix matching for `intake/[token]`. This is a known bug.

4. **Tier enforcement**: `Business.tier` field exists, TIERS constant defined, but zero features are gated. Will this ever be enforced?

5. **Training archive CSV vs server export**: `exportArchiveCSV` is client-side (uses Blob download). The main exports page uses server-side XLSX. Inconsistent approach — client CSV may fail on large datasets.

6. **Lead stages**: `constants.ts` has hardcoded LEAD_STAGES array, but the actual data comes from `LeadStage` table (per-business). These two are not synced. The `leads/page.tsx` fetches from API. The constants.ts version may be unused or stale.

7. **Legacy `User` model**: There's a legacy `User` model (per-tenant staff) alongside the newer `PlatformUser` model. The legacy model still has relations (appointed staff, created orders). Migration path unclear.

8. **`ts-node` binary missing**: No symlink in `node_modules/.bin/`. Seed scripts must use `node -e "require('ts-node').register(...);"` pattern — `npm run db:seed` will fail.

9. **Mobile experience**: `mobile-bottom-nav.tsx` component exists but sidebar overflow and mobile layout are not thoroughly tested. RTL mobile is fragile.

10. **No test coverage**: Three test files exist (`booking-engine.test.ts`, `order-calc.test.ts`, `permissions.test.ts`) but no test runner is configured. Tests can't run.

---

## 14. Deployment Workflow

### Branch structure
| Branch | Purpose | Who can push |
|--------|---------|-------------|
| `dev` | Daily development work | Direct push allowed |
| `staging` | Pre-production testing | Direct push allowed (via deploy script) |
| `main` | Production | **PR + approval only — no direct push** |

### Daily development cycle
1. Work on `dev` branch (or feature branches off `dev`)
2. Push to `dev` freely: `git push origin dev`
3. Vercel does NOT auto-deploy `dev` — it's local/testing only

### Deploying to staging
When a feature is ready to test:
```bash
# From dev (or any branch)
npm run deploy:staging
# → merges current branch into staging, pushes, Vercel builds staging automatically
```
Test the staging URL before proceeding to production.

### Deploying to production
Only after staging is verified:
```bash
npm run deploy:production
# → opens a Pull Request: staging → main
# → does NOT merge automatically
# → go to the GitHub PR link, review, approve, then merge
# → Vercel auto-deploys main to production on merge
```

**Never push directly to `main`.** Branch protection rules enforce this (see below).

### Branch protection rules (GitHub)
Set at: https://github.com/alldogneed/petra-app/settings/branches

**For `main`:**
- ✅ Require a pull request before merging
- ✅ Require approvals: **1**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging (add Vercel check when available)
- ✅ Do not allow bypassing the above settings (applies to admins too)
- ✅ Restrict who can push to matching branches → remove everyone (force PR-only)

**For `staging`:**
- No restrictions — direct push allowed

### Scripts
```bash
npm run deploy:staging     # merge current branch → staging, push, Vercel builds
npm run deploy:production  # open PR staging → main (manual approval required)
```

### Checklist before every production deploy
See `scripts/DEPLOY_CHECKLIST.md` — all boxes must be checked before merging the PR.

### Rollback
**Option A — Git revert (recommended):**
```bash
git checkout main && git pull origin main
git revert -m 1 HEAD   # revert merge commit
git push origin main   # Vercel auto-deploys
```
**Option B — Vercel instant rollback (fastest):**
Vercel dashboard → Deployments → click previous ✅ deployment → Promote to Production

### Vercel project settings

#### Connect branches to environments
In Vercel dashboard → Project → Settings → Git:
- **Production Branch**: `main`
- **Preview Branches**: add `staging` explicitly → assign it the "Staging" environment

#### Separate environment variables per environment
Vercel dashboard → Project → Settings → Environment Variables:
- For each variable, choose: Production / Preview / Development checkboxes
- Variables for `staging` environment go under **Preview** (scoped to `staging` branch)
- Variables for `main` go under **Production**

#### Staging vs Production Supabase (recommended)
To keep staging isolated from production data:
1. Create a second Supabase project (free tier) for staging
2. In Vercel → Environment Variables → Preview → set `DATABASE_URL` and `DIRECT_URL` to the staging Supabase connection strings
3. Production env vars keep pointing to the production Supabase project
4. Run `npx prisma db push` against the staging DB to apply the schema

> If you share the same Supabase project for both staging and production, any schema migration tested on staging will affect production data too — which is dangerous.

#### Staging URL
After connecting `staging` branch in Vercel, the staging URL will be something like:
`https://petra-app-git-staging-alldogneed-9395s-projects.vercel.app`

Find the exact URL in: Vercel dashboard → Deployments → filter by "staging" branch → click the deployment → copy the URL.

---

## 15. Supabase Setup (Two Projects — Staging + Production)

### Why two projects?
- Each Supabase project is a separate PostgreSQL database
- Staging DB can be destroyed/migrated freely without touching production data
- Free tier allows 2 projects per account (sufficient)

### Step 1 — Create staging project
1. Go to [supabase.com](https://supabase.com) → sign in → **New project**
2. Name: `petra-staging`
3. Password: generate a strong password and save it
4. Region: `ap-northeast-1` (Tokyo — matches Vercel `hnd1`)
5. Click **Create new project** — wait ~2 minutes

### Step 2 — Get staging connection strings
In `petra-staging` project → **Project Settings** → **Database** → **Connection string**:
- Switch to **URI** tab
- Copy **Transaction pooler** URL (port 6543, has `?pgbouncer=true`) → `DATABASE_URL`
- Copy **Session pooler** URL (port 5432) → `DIRECT_URL`
- Replace `[YOUR-PASSWORD]` placeholder with the password you set

### Step 3 — Create production project
Repeat steps 1–2 with name `petra-production`.

### Step 4 — Apply schema to both DBs
```bash
# Apply to staging DB (set DATABASE_URL + DIRECT_URL in .env.staging first, then:)
DATABASE_URL="<staging-txn-url>" DIRECT_URL="<staging-session-url>" \
  PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma db push

# Apply to production DB
DATABASE_URL="<prod-txn-url>" DIRECT_URL="<prod-session-url>" \
  PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma db push
```

### Step 5 — Set env vars in Vercel
Go to: Vercel → petra-app → Settings → Environment Variables

| Variable | Environment | Value |
|----------|-------------|-------|
| `DATABASE_URL` | Production | petra-production txn pooler URL |
| `DIRECT_URL` | Production | petra-production session pooler URL |
| `DATABASE_URL` | Preview (branch: staging) | petra-staging txn pooler URL |
| `DIRECT_URL` | Preview (branch: staging) | petra-staging session pooler URL |
| All other vars | Production | real production values |
| All other vars | Preview | staging/test values |

> In Vercel, when adding a Preview variable you can scope it to a specific branch (`staging`) so it only applies to that branch's deployments.

### Step 6 — Verify
After pushing to `staging` branch, check the Vercel deployment log. It should show `prisma generate` succeeding and the app booting without `Missing required environment variable: DATABASE_URL` errors.

---

## 16. Initial Git Setup (One-Time)

These commands set up the three-branch structure. **Already done** for this repo — documented here for reference if rebuilding.

```bash
# 1. Ensure you're on main (production branch)
git checkout main

# 2. Create staging branch from main
git checkout -b staging
git push -u origin staging

# 3. Create dev branch from main
git checkout -b dev
git push -u origin dev

# 4. Return to dev for daily work
git checkout dev
```

### Daily development workflow
```bash
# Work on dev (or a feature branch off dev)
git checkout dev
# ... make changes, commit ...
git add -p   # or: git add specific-files
git commit -m "feat: ..."
git push origin dev

# When ready to test on staging:
npm run deploy:staging
# → merges dev into staging, pushes, Vercel builds staging

# When staging is verified and ready for production:
npm run deploy:production
# → opens a PR: staging → main (requires review + approval to merge)
# → after merge, Vercel auto-deploys to production
```
