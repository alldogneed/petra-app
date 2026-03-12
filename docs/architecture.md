# Petra — Architecture Reference

## Tech Stack

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
| `@radix-ui/*` | Headless UI primitives |
| `class-variance-authority` + `clsx` + `tailwind-merge` | Conditional class utilities |
| `@dnd-kit/core` + `/sortable` + `/utilities` | Drag-and-drop |
| `recharts` ^3.7.0 | Charts (analytics page) |
| `date-fns` ^4.1.0 | Date manipulation |
| `bcryptjs` ^2.4.3 | Password hashing |
| `resend` ^6.9.2 | Transactional email |
| `twilio` ^5.12.2 | WhatsApp/SMS messaging |
| `stripe` ^20.4.0 | Payment processing (per-business Stripe keys) |
| `xlsx` ^0.18.5 | Excel export |
| `qrcode` ^1.5.4 | Service dog ID card QR codes |
| `zod` ^3.25.76 | Runtime schema validation (sparse) |
| `@vercel/blob` ^2.3.1 | File storage |

### Dev
| Package | Purpose |
|---------|---------|
| `prisma` ^5 | Schema + migrations CLI |
| `ts-node` ^10 | Seed scripts |
| `typescript` ^5 | Type checking |
| `postcss` 8.4.47 | **PINNED — NEVER UPDATE** (8.5.x breaks Next.js 14) |
| `eslint` + `eslint-config-next` | Linting |

### Services
| Service | Use |
|---------|-----|
| **Supabase** (PostgreSQL) | Production DB (txn pooler port 6543, direct port 5432) |
| **Vercel** | Hosting + edge functions |
| **Resend** | Email (password reset, reminders). `petra-app.com` verified. |
| **Meta Cloud API** | WhatsApp (primary — `META_WHATSAPP_TOKEN` + `META_PHONE_NUMBER_ID`) |
| **Twilio** | WhatsApp fallback |
| **Google OAuth + Calendar** | Login with Google + GCal sync |
| **Morning (Green Invoice)** | Israeli invoicing |
| **Stripe** | Online payments |
| **Make.com** | Lead ingestion webhooks |
| **Vercel Blob** | File uploads |

---

## Folder Structure

```
petra-app/
├── prisma/
│   ├── schema.prisma              # Dev schema
│   ├── schema.production.prisma   # Production schema (used by Vercel — keep in sync!)
│   ├── seed.ts / seed-admin.ts / seed-service-dogs.ts
│   └── dev.db                     # SQLite file (dev only)
├── public/                        # favicon.ico, icon.png, icon-512.png, apple-icon.png
├── docs/                          # Reference docs (this folder)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root: <html lang="he" dir="rtl">, QueryProvider + AuthProvider
│   │   ├── (dashboard)/           # Auth-gated pages (AppShell)
│   │   │   └── layout.tsx         # AppShell + Toaster
│   │   └── api/                   # ~60 route dirs, ~197 route files
│   ├── components/
│   │   ├── layout/                # app-shell, sidebar, topbar, NotificationBell
│   │   ├── ui/                    # shadcn/ui components
│   │   └── (feature folders)      # admin, analytics, boarding, dashboard, service-dogs, etc.
│   ├── lib/
│   │   ├── prisma.ts              # PrismaClient singleton (named + default export)
│   │   ├── auth.ts / session.ts / auth-guards.ts / permissions.ts
│   │   ├── utils.ts               # cn, DEMO_BUSINESS_ID, formatCurrency, formatDate, etc.
│   │   ├── constants.ts           # TIERS, VAT_RATE, LEAD_STAGES, SERVICE_TYPES
│   │   ├── feature-flags.ts       # Tier/feature matrix, FREE limits
│   │   ├── whatsapp.ts            # sendWhatsAppMessage() — Meta (primary), Twilio (fallback)
│   │   ├── env.ts                 # Typed env vars (server-side only)
│   │   └── (other service libs)
│   ├── hooks/
│   │   ├── usePlan.ts             # can(), tier, isFree, isPro, trialActive, trialDaysLeft
│   │   └── useSubscription.ts     # maxCustomers, maxLeads, maxTrainingPrograms
│   ├── middleware.ts              # Auth gate: checks petra_session cookie
│   └── providers/
│       ├── query-provider.tsx     # React Query (staleTime: 5min, gcTime: 10min)
│       └── auth-provider.tsx      # AuthProvider + useAuth()
├── .env
├── vercel.json                    # Cron jobs (5 daily) + Vercel config
├── next.config.mjs
├── tailwind.config.ts             # Brand colors, Heebo font, animations
└── tsconfig.json                  # @/* → ./src/* path alias
```

---

## Database Schema (50+ Prisma models)

### Platform / Auth
| Model | Purpose |
|-------|---------|
| `PlatformUser` | Global user. email, passwordHash, googleId, 2FA, GCal OAuth, platformRole |
| `BusinessUser` | PlatformUser ↔ Business link (role: owner/manager/user) |
| `AdminSession` | Server session (`petra_session` cookie, configurable TTL) |
| `PasswordResetToken` | Single-use, 1-hour reset tokens |
| `AuditLog` | Platform action audit trail |
| `ActivityLog` | Privacy-safe business action log |
| `FeatureFlag` | Platform-level feature flags |
| `UserConsent` | ToS acceptance evidence |

### Business / Tenant
| Model | Purpose |
|-------|---------|
| `Business` | Tenant root. slug, tier, boarding/booking config, webhookApiKey |
| `Customer` | name, phone, email, address, notes, tags (JSON), documents (JSON) |
| `Pet` | customerId `String?` (nullable — standalone service dogs use businessId directly) |
| `Service` | Bookable services with duration, price |
| `Appointment` | date, startTime/endTime (HH:mm strings), status |

### Boarding
`BoardingStay`, `Room`, `BoardingCareLog` (FEEDING/MEDICATION/WALK/NOTE)

### CRM / Leads
`Lead`, `LeadStage` (per-business UUIDs — NOT hardcoded strings), `CallLog`, `TimelineEvent` (NO title field — use type + description only)

### Finance
`Payment`, `PriceList`, `PriceListItem`, `Order`, `OrderLine`, `InvoicingSettings`, `InvoiceDocument`, `StripeSettings`

### Messaging
`MessageTemplate`, `AutomationRule`, `ScheduledMessage`, `SystemMessage`

### Tasks
`Task` (categories: BOARDING/TRAINING/LEADS/GENERAL/HEALTH/MEDICATION/FEEDING), `TaskTemplate`, `TaskRecurrenceRule`

### Training
`TrainingProgram` (trainingType: HOME/BOARDING/SERVICE_DOG), `TrainingGoal`, `TrainingProgramSession`, `TrainingPackage`, `TrainingGroup`, `TrainingGroupParticipant`, `TrainingGroupAttendance`

### Service Dogs
| Model | Purpose |
|-------|---------|
| `ServiceDogProfile` | phase (SELECTION→TRAINING→ADVANCED→PLACEMENT→CERTIFIED→RETIRED), `currentLocation` (TRAINER/FOSTER/BOARDING/FIELD default TRAINER), dogPhoto (base64), milestones (JSON), trainingTests (JSON) |
| `ServiceDogInsurance` | policyNumber, policyDocument (base64) |
| `ServiceDogRecipient` | disability info, fundingSource, attachments (JSON), meetings (JSON) |
| `ServiceRecipientStage` | Custom kanban stages (auto-seeded 8 defaults) |
| `ServiceDogPlacement` | Dog↔Recipient match (PENDING/TRIAL/ACTIVE/TERMINATED) |
| `ServiceDogMedicalProtocol` | Phase-based medical requirements, auto-generated |
| `ServiceDogIDCard` | QR token — public endpoint `/api/service-dogs/id-card/[token]` |

### Online Booking
`AvailabilityRule`, `AvailabilityBlock`, `AvailabilityBreak`, `Booking`, `BookingDog`, `SyncJob`

### Other
`IntakeForm`, `DogHealth`, `DogBehavior` (`fears` is `Boolean` — NOT array), `DogMedication`, `ImportBatch`, `ExportJob`, `AnalyticsEvent`, `OnboardingProfile`, `OnboardingProgress`

---

## Environment Variables

```bash
# Required (throws at startup if missing)
DATABASE_URL="postgresql://..."        # Transaction pooler (port 6543)
DIRECT_URL="postgresql://..."          # Session pooler (port 5432)

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
GCAL_REDIRECT_URI="http://localhost:3000/api/integrations/google/callback"
GCAL_ENCRYPTION_KEY=""    # 32-byte hex

# App
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET=""

# Encryption keys (32-byte hex each)
INVOICING_ENCRYPTION_KEY=""
STRIPE_ENCRYPTION_KEY=""

# Email
RESEND_API_KEY=""
EMAIL_FROM="Petra <noreply@petra-app.com>"

# WhatsApp (Meta primary, Twilio fallback)
META_WHATSAPP_TOKEN=""
META_PHONE_NUMBER_ID=""
META_WHATSAPP_BUSINESS_ACCOUNT_ID=""
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_FROM="+14155238886"

# Webhooks
MAKE_WEBHOOK_SECRET=""
WEBHOOK_BUSINESS_ID=""
BLOB_READ_WRITE_TOKEN=""
```

### `env.ts` — typed server access
```typescript
import { env, isDev, isProd, isStaging } from "@/lib/env";
// NEVER import from a Client Component — throws at runtime
// For client: use process.env.NEXT_PUBLIC_* directly
```
