# Petra — Feature Map

## Tier Enforcement
- `src/lib/feature-flags.ts` — `hasFeature()`, `FREE_CUSTOMER_LIMIT=50`, `FREE_LEAD_LIMIT=20`, `FREE_TRAINING_LIMIT=20`
- `src/hooks/usePlan.ts` — `can(feature)`, `tier`, `isFree`, `isPro`, `trialActive`, `trialDaysLeft`
- `src/components/paywall/TierGate.tsx` + `PaywallCard.tsx` — gating UI
- `businessEffectiveTier` — computed at login; expired trial → "free"
- **FREE includes:** customers (50), leads (20), training (20), payments, orders, pricing
- **FREE locked:** boarding, messages, automations, service-dogs, staff, invoicing, gcal, online_bookings, analytics, intake_forms, payment_links, pets_advanced
- Suspended business → 403 on all API routes

## Dashboard (`/dashboard`)
- Stats: customers, today's appointments, monthly revenue, open tasks
- Upcoming appointments (8), open tasks (5), quick links
- Trial expiry banner (amber ≤7 days, red expired)

## Customers (`/customers`, `/customers/[id]`)
- Searchable table, new customer modal, CSV export, delete
- Profile: pets, appointment history, timeline events, DogHealth/DogBehavior/DogMedication CRUD

## Calendar (`/calendar`)
- Weekly grid Sun–Sat 08:00–20:00 (64px/hour)
- Click cell → new appointment; click appointment → detail popup (complete/cancel)

## Tasks (`/tasks`)
- Filterable by status + category, priority indicators

## Leads (`/leads`)
- Kanban with custom `LeadStage` (UUID strings — NOT hardcoded)
- Drag stage, call log, won/lost with reason, convert to customer

## Messages + Automations (`/messages`)
- Template cards with inline automation toggle
- `/automations` → redirects to `/messages`
- Trigger IDs: `appointment_reminder`, `appointment_followup`, `birthday_reminder`, `lead_followup`
- `GET /api/messages` includes `automationRules: { id, trigger, triggerOffset, isActive }`

## Boarding (`/boarding`)
- Room grid + stays, care logs (FEEDING/MEDICATION/WALK/NOTE) via `/api/boarding/[id]/care-logs`
- "כלבי שירות בפנסיון" section shows dogs with `currentLocation=BOARDING`

## Training (`/training`) — 7 tabs
| Tab | Content |
|-----|---------|
| סקירה | Active dogs, alerts (≤2 sessions, 14+ day gap) |
| אילוף פרטני | HOME programs, sessions, goals, homework |
| אילוף בפנסיון | BOARDING programs, weekly update modal |
| קבוצות | Groups + workshops |
| כלבי שירות | SERVICE_DOG programs (managed via `/service-dogs/*`) |
| חבילות | TrainingPackage CRUD |
| ארכיון | Completed/canceled with date filter + CSV |

**Training order auto-creation** (`POST /api/orders`):
- `trainingSubType=boarding` → BoardingStay + TrainingProgram(BOARDING)
- `trainingSubType=package` → TrainingProgram(isPackage:true)
- `trainingSubType=group` → upserts TrainingGroupParticipant (no separate program)
- `trainingSubType=private` → TrainingProgram(HOME)

## Service Dogs (`/service-dogs/*`)
| Page | Purpose |
|------|---------|
| `/service-dogs` | Overview: phase counts, alerts, protocol reminders |
| `/service-dogs/dogs` | Dog card grid with phase filter |
| `/service-dogs/[id]` | Dog profile: 10 tabs (תיק כלב, protocols, training log, milestones, insurance, equipment, tests, gov reports, placements, docs, certification) |
| `/service-dogs/recipients` | Kanban with `ServiceRecipientStage` columns |
| `/service-dogs/recipients/[id]` | Recipient profile |
| `/service-dogs/placements` | Dog↔Recipient matches |
| `/service-dogs/reports` | Certification renewals + funding summary + XLSX export |

- `currentLocation`: TRAINER (default, hidden in UI) / FOSTER / BOARDING / FIELD
- `LOCATION_OPTIONS` in `src/lib/service-dogs.ts`
- Public QR endpoint: `/api/service-dogs/id-card/[token]` — no auth
- `training-programs` API excludes SERVICE_DOG by default — use `?trainingType=SERVICE_DOG`
- End-of-process: `POST /api/service-placements/[id]/complete` → placement→COMPLETED, dog→RETIRED, recipient→CLOSED

## Finance
- **Payments** (`/payments`): table, stats, new payment modal
- **Orders** (`/orders`): list + detail, training sub-types
- **Invoicing** (`/invoices`): Morning (Green Invoice) integration
- **Pricing** (`/pricing`): Service CRUD + PriceListItem CRUD (soft-delete)
- **Price Lists** (`/price-lists`): PriceList containers

## Other Modules
- **Analytics** (`/analytics`): recharts — appointments, revenue, customer acquisition (pro+ only)
- **Settings** (`/settings`): business profile, services, data export, logo
- **Bookings** (`/bookings`): online booking approval queue (pro+ only)
- **Availability** (`/availability`): hours, blocks, breaks
- **Online Booking** (`/book/[businessId]`): public wizard, availability engine, GCal sync
- **Intake Forms** (`/intake-forms`, `/intake/[token]`): pet health questionnaire
- **Business Admin** (`/business-admin`): team CRUD, active sessions
- **Exports** (`/exports`): XLSX/CSV for customers + pets
- **Import** (`/import`): CSV bulk import with preview
- **Feeding/Medications/Vaccinations**: boarding pet health tracking
- **Pets** (`/pets`, `/pets/[id]`): standalone pet management

## Cron Jobs (5 total in `vercel.json`)
- `send-reminders` (daily + GitHub Actions every 15min)
- `generate-tasks` (daily)
- `birthday-reminders` (daily)
- `vaccination-reminders` (daily)
- `service-dog-alerts` (daily)
- `process-jobs` (GCal sync — GitHub Actions every 5min)

## GCal Sync
- Appointments sync on create/update/cancel/delete (`Appointment.gcalEventId` field)
- `syncAppointmentToGcal`, `deleteAppointmentFromGcal` in `src/lib/google-calendar.ts`

## Pre-Launch Blockers
1. 🔴 WhatsApp Business Verification (Meta) — in review
2. Stripe Checkout routes missing (`POST /api/orders/[id]/checkout` + `POST /api/webhooks/stripe`)
3. Sentry not installed (removed from `next.config.mjs` — needs `npm install @sentry/nextjs`)
4. `CRON_SECRET` must be in both Vercel env + GitHub repo secrets
