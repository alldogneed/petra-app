# Petra App — Business Logic & Core Flows

> Reverse-engineered from controllers, services, and API routes.
> All `businessId` values are derived from the session — never from request body/params (IDOR rule).

---

## Table of Contents

1. [User / Trainer Registration & Onboarding](#1-user--trainer-registration--onboarding)
2. [Authentication & Sessions](#2-authentication--sessions)
3. [Dog Profile Creation](#3-dog-profile-creation)
4. [Scheduling & Calendar Management](#4-scheduling--calendar-management)
5. [Billing & Payments](#5-billing--payments)
6. [Lead Management (CRM)](#6-lead-management-crm)
7. [Boarding Management](#7-boarding-management)
8. [Training Programs](#8-training-programs)
9. [Service Dogs Module](#9-service-dogs-module)
10. [WhatsApp & Messaging](#10-whatsapp--messaging)
11. [Online Public Booking](#11-online-public-booking)
12. [Platform Admin](#12-platform-admin)
13. [Cron Jobs & Automations](#13-cron-jobs--automations)
14. [Tier / Feature Gate Enforcement](#14-tier--feature-gate-enforcement)

---

## 1. User / Trainer Registration & Onboarding

### New Trainer Signs Up

1. **POST `/api/auth/register`**
   - Accepts: `name`, `email`, `password`, `businessName`, `tier?`, `trial?`
   - Validates: email format, password strength, no duplicate email
   - Creates `PlatformUser` with `bcrypt`-hashed password
   - Creates `Business` with chosen `tier` (default `"basic"`)
   - Creates `BusinessUser` with role `"owner"` linking user → business
   - If `?trial=1` query param: routes to checkout tokenization flow instead of direct login
   - Fires `sendWelcomeEmail()` or `sendTrialWelcomeEmail()` via Resend
   - Logs `ActivityLog` action `"REGISTER"`
   - Returns session cookie

2. **Onboarding wizard** (`OnboardingProfile` + `OnboardingProgress`)
   - Step 0 (welcome): shown on first login
   - Step 1: create first customer
   - Step 2: add that customer's first pet
   - Step 3: create first appointment
   - Step 4: explore dashboard
   - Skippable at any point; `skipped = true` stored in DB
   - `lastCustomerId` stored so step 2 can resume on the correct dog

### Trial + Card Registration Flow

1. Trainer selects a paid plan → redirected to `/checkout?tier=X&trial=1`
2. Checkout page shows ₪0 today badge, 14-day trial terms
3. **POST `/api/cardcom/create-tokenization`**
   - Cardcom `Operation=4` — saves card token, **no charge**
   - Returns a redirect URL to Cardcom's tokenization page
4. Customer fills card details on Cardcom; Cardcom calls webhook back
5. **Webhook → `/api/cardcom/trial-indicator`** (5-layer validation):
   - Validates HMAC signature
   - Saves `cardcomToken` + `cardcomTokenExpiry` to `Business`
   - Sets `trialEndsAt = now() + 14 days`
   - Sets `subscriptionStatus = "active"`
   - Creates `SubscriptionEvent` row
   - Fires `sendTrialWelcomeEmail()`
6. User redirected to `/payment/trial-success`

---

## 2. Authentication & Sessions

### Login Flow

1. **POST `/api/auth/login`** (rate-limited: 10 req / 10 min per IP)
   - Looks up `PlatformUser` by email
   - If not found: runs dummy bcrypt compare (timing-safe) then returns 401
   - Compares password with `bcrypt` (12 rounds)
   - If 2FA enabled: returns `{ requires2FA: true }` without creating session
   - On success: calls `createSession(userId, rememberMe?)`
     - Generates 256-bit random hex token
     - Hashes it with SHA-256 for storage
     - Stores `AdminSession` with `expiresAt` = 8h (or 30d if rememberMe)
     - Sets HttpOnly `petra_session` cookie
   - Updates `lastLoginAt` (fire-and-forget)
   - Logs `ActivityLog` action `"LOGIN"`

2. **2FA verification** (POST `/api/auth/2fa/verify`)
   - Validates TOTP code via `otplib`
   - Sets `twoFaVerified = true` on session
   - Invalidates session cache for that user

### Session Validation (every protected request)

1. Read `petra_session` cookie
2. Hash the raw token → look up `AdminSession` (uses in-memory cache, 30s TTL)
3. Check `expiresAt` and `isActive`
4. Refresh `lastSeenAt` every 5 minutes (fire-and-forget)
5. Return `FullSession` with `user`, `memberships`, impersonation fields

### Permission Check

- `requireBusinessAuth(request)` → extracts `businessId` from session's active membership
- `requireTenantPermission(request, permission)` → checks role against permission matrix
- `isGuardError(result)` → type guard to detect early-return errors

---

## 3. Dog Profile Creation

### Adding a Pet to a Customer

1. **POST `/api/customers/[id]/pets`** or **POST `/api/pets`**
   - Auth: `requireBusinessAuth` → derive `businessId` from session
   - Validates customer belongs to same business (IDOR check)
   - Accepts: `name`, `species`, `breed`, `birthDate`, `weight`, `gender`, `microchip`, `color`, `isNeutered`, `medicalNotes`, `foodNotes`, `behaviorNotes`, `foodBrand`, `foodGramsPerDay`, `foodFrequency`
   - Creates `Pet` record with `customerId` (nullable — optional chain everywhere)
   - Optionally creates `DogHealth` record if health data is included
   - Logs `TimelineEvent` for the customer: `{ type: "PET_ADDED", description: "..." }`

### Standalone Service Dog (no customer)

- `Pet.customerId = null`, `Pet.businessId = businessId`
- `ServiceDogProfile` created linked to the pet
- Phase defaults to `"SELECTION"` — must progress through defined phase order

### Dog Health Tracking

- `DogHealth` record is one-to-one with `Pet`
- Stores vaccine dates, deworming dates, vet clearance dates
- Expiry logic:
  - `DEWORMING`: `dewormingValidUntil` (set directly) or `lastDate + 180 days`
  - `PARK_WORM`: uses `parkWormValidUntil` field directly
- `PetWeightEntry` logs historical weight changes

---

## 4. Scheduling & Calendar Management

### Creating an Internal Appointment

1. **POST `/api/appointments`**
   - Auth: session businessId
   - Accepts: `customerId`, `petId?`, `serviceId?`, `priceListItemId?`, `date`, `startTime`, `endTime`, `staffId?`, `notes?`
   - Validates customer belongs to business
   - Creates `Appointment` record
   - If business has Google Calendar connected (`gcalConnected = true`):
     - Calls Google Calendar API to create event
     - Stores `gcalEventId` on the appointment
   - If PRO+ tier: optionally schedules a WhatsApp reminder via `scheduleAppointmentReminder()`
   - Logs `TimelineEvent` for the customer
   - Returns appointment with toast action: "שלח תזכורת WhatsApp" (PRO+ only)

2. **PATCH `/api/appointments/[id]`** — update status, times, notes
   - Status transitions: `scheduled → completed | cancelled`
   - On cancellation: stores `cancellationNote`
   - GCal event updated if `gcalEventId` exists

3. **GET `/api/appointments`** — list with date filters
   - `from`/`to` params → filter by `createdAt`
   - `startFrom`/`startTo` params → filter by `startAt` (used by calendar view)

### Calendar View Logic

- Weekly/monthly view aggregates: `appointments`, `boardingStays`, `orders` (grooming)
- All events rendered by `date` (appointments) or `checkIn` (boarding)
- `orders` calendar query uses `startFrom`/`startTo` to filter by `startAt`
- Legend items use `line-through` style for completed/cancelled events
- Minimum event height: 40px

### WhatsApp Appointment Reminder

1. `scheduleAppointmentReminder(appointmentId, businessId)`
   - Checks `Business.whatsappRemindersEnabled`
   - Checks `hasFeature(tier, "whatsapp_reminders")` (PRO+ only)
   - Calculates send time: `appointment.date - whatsappReminderLeadHours`
   - Creates `ScheduledMessage` record
2. CRON picks up `ScheduledMessage` where `status = "pending"` and `scheduledFor <= now()`
3. Calls `sendWhatsAppMessage(phone, body)` → Meta Cloud API

### Manual Reminder (PRO+)

- **POST `/api/appointments/[id]/remind`**
  - 403 if tier lacks `whatsapp_reminders`
  - Sends immediately via `sendWhatsAppMessage()`

### Google Calendar Sync (Bookings)

- `Booking` created → `SyncJob` enqueued with `action = "create"`
- CRON `/api/cron/sync-gcal` processes queued `SyncJob` records
- Calls Google Calendar API with OAuth tokens from `PlatformUser.gcalAccessToken`
- On success: updates `Booking.gcalEventId`, `gcalSyncStatus = "synced"`
- On failure: increments `attempts`, stores `lastError`, retries at `nextRunAt`

---

## 5. Billing & Payments

### Recording a Payment

1. **POST `/api/payments`**
   - Accepts: `amount`, `method`, `status`, `appointmentId?`, `boardingStayId?`, `orderId?`, `customerId`, `isDeposit?`, `paidAt?`
   - Validates linked entity (appointment/order) belongs to same business
   - Creates `Payment` record
   - Logs `TimelineEvent`: `{ type: "PAYMENT_RECEIVED", description: "₪XXX" }`
   - If `InvoicingSettings` configured: triggers invoice generation via provider API

### Orders Flow

1. **POST `/api/orders`** — create order with line items
   - Accepts `customerId`, `lines[]` (priceListItemId, quantity, unitPrice)
   - Calculates `subtotal`, `discountAmount`, `taxTotal`, `total`
   - VAT rate: `Business.vatRate` (default 17%)
   - Status starts as `"draft"` → becomes `"open"` when finalized

2. **Payment request** (WhatsApp):
   - `buildPaymentRequestMessage()` — itemized message with service names + totals
   - Sends via `wa.me` deep-link (opens WhatsApp on device — not direct API send)
   - Button shown on: order detail page, `CreateOrderModal` success step

3. **Stripe Checkout** (partial):
   - `POST /api/orders/[id]/checkout` → creates Stripe PaymentIntent / link
   - `/api/webhooks/stripe` → not yet built

### Trial Auto-Charge (Cardcom)

1. **CRON `/api/cron/charge-trials`** — runs daily at 06:00 UTC
   - Queries businesses where `trialEndsAt < now()` AND `subscriptionStatus = "active"` AND `cardcomToken != null`
   - For each: calls Cardcom `BillGold.aspx` with `Operation=2` (charge)
   - On success: sets `subscriptionStatus = "active"`, `trialEndsAt = null`, logs `SubscriptionEvent`
   - On failure: logs error, sets `subscriptionStatus = "expired"`

### Subscription Cancellation

1. **POST `/api/subscription/cancel`**
   - Clears `cardcomToken` + `cardcomTokenExpiry`
   - Sets `subscriptionStatus = "cancelled"`
   - Downgrades `tier` to `"free"`
   - Fires cancellation email via `sendEmail()`

### Invoice Generation

- `InvoicingSettings` stores provider config (Morning / iCount / Rivhit) with encrypted credentials
- On payment creation: `InvoiceJob` created → background processing
- Provider API called → `InvoiceDocument` saved with provider's document ID
- PDF URL stored for download

---

## 6. Lead Management (CRM)

### Lead Creation

1. **POST `/api/leads`**
   - Creates `Lead` with `stage` = first non-won/non-lost `LeadStage` UUID from DB
   - **Never hardcode stage strings** — always query `LeadStage` table
   - Source: `"manual"` \| `"online_booking"` \| `"whatsapp"` \| `"referral"` \| etc.
   - If `googleContactsSync = true`: syncs to Google Contacts via People API

2. Stages are business-specific `LeadStage` records with custom names/colors/order
   - Won stages: `isWon = true` → triggers lead conversion
   - Lost stages: `isLost = true` → triggers loss reason capture

### Lead Stage Progression

1. **PATCH `/api/leads/[id]`** with `{ stageId: "<uuid>" }`
   - Validates `stageId` belongs to business's `LeadStage` records
   - Updates `lead.stage`
   - Creates `CallLog` entry with `type = "stage_change"`
   - If new stage `isWon = true`:
     - Sets `wonAt`, `wonByUserId`
     - Creates `Customer` record from lead data
     - Sets `lead.customerId`
     - Logs `TimelineEvent`: `"LEAD_WON"`
   - If new stage `isLost = true`:
     - Sets `lostAt`, `lostReasonCode`, `lostReasonText`
     - Stores `previousStageId` for potential restore

### Lead Restore (from Won/Lost)

- **PATCH `/api/leads/[id]`** with `{ restore: true }`
- Restores `lead.stage = lead.previousStageId`
- Clears `wonAt` / `lostAt` fields

### Lead Aging Indicator

- Always shown in kanban cards (no toggle)
- Green: < 4 days since creation
- Orange: ≥ 4 days
- Red: ≥ 8 days

---

## 7. Boarding Management

### Check-In Flow

1. **POST `/api/boarding`** — create boarding stay
   - Accepts: `petId`, `customerId?`, `checkIn`, `checkOut?`, `roomId?`, `feedingPlan?`, `medicalNeeds?`, `notes?`
   - Status: `"reserved"`
   - Check-in date onChange in UI → auto-resets checkout to same day
   - Optionally syncs to Google Calendar (creates `gcalEventId`)

2. **PATCH `/api/boarding/[id]`** — `status = "checked_in"` on arrival

3. Care logs added throughout stay:
   - **POST `/api/boarding/[id]/care-logs`**
   - Types: `FEEDING`, `MEDICATION`, `WALK`, `NOTE`

4. **PATCH `/api/boarding/[id]`** — `status = "checked_out"`, set `checkOut` time

### Overdue Detection

- Dashboard shows overdue banner when `BoardingStay.checkOut < now()` and `status != "checked_out"`
- Banner shows hours overdue per pet + "טפל עכשיו" CTA
- CTA switches to "active" tab in boarding list

### Pricing Calculation

- `boardingCalcMode = "nights"`: charges per night (checkOut.date - checkIn.date)
- `boardingMinNights = 1`: minimum 1 night charge
- Room `pricePerNight` overrides `Business.boardingPricePerNight`
- VAT applied at `Business.vatRate`

---

## 8. Training Programs

### Program Creation

1. **POST `/api/training-programs`**
   - Links to `Pet` (dogId) and optionally `Customer`, `TrainingPackage`, `Order`
   - `programType`: `BASIC_OBEDIENCE` \| `REACTIVITY` \| `PUPPY` \| `BEHAVIOR` \| `ADVANCED` \| `CUSTOM`
   - `trainingType`: `HOME` \| `BOARDING` \| `SERVICE_DOG`
   - `totalSessions`: planned count
   - `sessionsCompleted`: counter incremented per logged session

2. **POST `/api/training-programs/[id]/sessions`** — log a training session
   - Status: `PLANNED` → `COMPLETED` \| `MISSED`
   - Increments `sessionsCompleted` on program

3. **POST `/api/training-programs/[id]/goals`** — add training goal
   - Goal has `status`: `ACTIVE` \| `ACHIEVED` \| `DROPPED`

### Group Training

- `TrainingGroup` with `maxParticipants` limit
- Participants: many-to-many via `TrainingGroupParticipant` (Customer + Pet)
- Schedule stored as JSON

---

## 9. Service Dogs Module

### Dog Phase Progression

- Phases (in order): `SELECTION → RAISING → PUPPY → IN_TRAINING → ADVANCED_TRAINING → CERTIFIED → RETIRED → DECERTIFIED`
- **Single source of truth**: `SERVICE_DOG_PHASES` constant in `src/lib/service-dogs.ts`
- **PATCH `/api/service-dogs/[id]/phase`** — validates against `VALID_PHASES` (derived from constant)
- Each phase triggers different medical protocol requirements (`PHASE_MEDICAL_PROTOCOLS`)

### Medical Protocols

- 19 protocols across 5 categories (vaccines, treatments, health checks, behavior, vet clearance)
- Vaccine order displayed as: כלבת → משושה גורים → משושה בוגר → תילוע → תולעת הפארק → קרציות ופרעושים → שעלת מכלאות
- Labels rendered: `MEDICAL_PROTOCOL_MAP[key]?.label ?? storedLabel` (overrides stale DB labels)
- Expiry dates tracked per protocol

### Recipient Pipeline

- Recipients flow through `ServiceRecipientStage` kanban
- `DEFAULT_STAGES` auto-upserted on every `GET /api/service-recipient-stages`:
  - Stages include a `REJECTED` stage = archive
  - Archive hidden by default; toggle via "ארכיון" button (red when active)
- `AddRecipientModal` receives stages filtered to exclude `REJECTED`

### Placement

1. **POST `/api/service-placements`**
   - Validates no active placement exists for this dog (`status = "ACTIVE"`)
   - Status: `"ACTIVE"` (default) or `"TERMINATED"` — **only these two values**
   - `TERMINATED` status:
     - Logs `ServiceDogComplianceEvent`
     - Sets recipient back to `LEAD` stage

2. **PATCH `/api/service-placements/[id]`** — terminate placement
   - Sets `terminatedAt`, `terminationReason`

### Training Tests

- Stored as JSON array in `ServiceDogProfile.trainingTests`
- Test types include `SIMBA_COMBINED` (public space + tasks combined), `ANNUAL_RETEST`, `PSA`, etc.
- `SIMBA_COMBINED`: PS + FT sections; auto-computed overall result shown as suggestion
- All test types: overall result (`PASS` \| `CONDITIONAL_PASS` \| `FAIL`) manually selectable
- `ANNUAL_RETEST`: `nextRenewalDate` field; red banner = expired, amber = within 30 days
- File uploads stored to Vercel Blob → URL saved in test object

### XLSX Export

- **GET `/api/service-dogs/export`** — exports dog list as Excel
- Includes column: "תאריך בחינה שנתית מחזורית" (from latest `ANNUAL_RETEST.nextRenewalDate`)

---

## 10. WhatsApp & Messaging

### Message Send Flow

1. `sendWhatsAppMessage(phone, text)` in `src/lib/whatsapp.ts`
   - Primary: Meta Cloud API (`POST /messages` via `META_PHONE_NUMBER_ID`)
   - Fallback: Twilio (if Meta fails)
   - Stub mode: when no credentials configured (dev)

2. `sendWhatsAppTemplate(phone, templateName, params)` — approved Meta templates
   - Templates: `petra_appointment_reminder`, `petra_appointment_confirmation`, `petra_boarding_checkout`, `petra_boarding_thank_you`, `petra_boarding_confirmation`
   - All templates under WABA `25882288788086856`

### Template Placeholder Substitution

- `interpolateTemplate(body, variables)` replaces: `{customerName}`, `{petName}`, `{petAge}`, `{date}`, `{time}`, `{serviceName}`, `{businessPhone}`, `{paymentUrl}`, `{orderTotal}`

### Automation Triggers

| Trigger | Offset | Notes |
|---------|--------|-------|
| `on_appointment` | configurable | Appointment reminder |
| `payment_request` | immediate | Payment request WhatsApp |
| `on_boarding_checkout` | day-of | Boarding checkout thank-you |
| `on_lead_stage_change` | immediate | CRM nurture |

### Manual WhatsApp (wa.me links)

- Calendar panel + customer profile: MessageCircle button → opens `wa.me/972XXXXXXXXX?text=...`
- This is a **deep-link** (opens WhatsApp on device) — **not** a direct API send
- PRO+ tier required to see these buttons

---

## 11. Online Public Booking

### Public Booking Flow

1. Customer visits `/book/[slug]` (no auth required)
2. Selects service from `PriceListItem` where `isBookableOnline = true`
3. Picks available slot (computed from `AvailabilityRule` - `AvailabilityBlock` - `AvailabilityBreak` - existing confirmed bookings)
4. Fills contact form (name, phone, pet info, notes)
5. If `depositRequired`: shown payment instructions or link
6. **POST `/api/booking`** (public, uses `DEMO_BUSINESS_ID` for demo; real slug → real businessId)
   - Creates `Customer` if phone not found
   - Creates `Booking` with `status = "pending"`, `source = "online"`
   - Creates `customerToken` (cuid) for self-service access
   - Sends confirmation email to customer
7. Business owner sees new booking in dashboard
8. **PATCH `/api/bookings/[id]`** — confirm or decline
   - On confirm: status → `"confirmed"`, optional GCal sync via `SyncJob`
   - Customer can view their booking at `/my-booking/[token]`

### Availability Slot Calculation

1. Get `AvailabilityRule` for day of week → open hours window
2. Subtract `AvailabilityBlock` periods (vacations)
3. Subtract `AvailabilityBreak` periods (lunch etc.)
4. Subtract existing `Booking` slots (confirmed/pending) + buffer minutes
5. Return list of free start times for the selected service duration

---

## 12. Platform Admin

### Tenant Management

- **GET/POST/PATCH `/api/owner/tenants`** — list, create, update businesses
- Suspend a tenant: `Business.status = "suspended"`
- Feature overrides: **PATCH `/api/owner/tenants/[id]/features`** — sets `featureOverrides` JSON

### Impersonation

- **POST `/api/owner/tenants/[id]/impersonate`** (super_admin only)
- Sets `AdminSession.impersonatedBusinessId`
- All subsequent requests from that session use impersonated `businessId`
- Exit: **POST `/api/owner/impersonation/exit`** — clears impersonation fields

### Master Admin Dashboard

- `GET /api/owner/stats` returns:
  - Total businesses, active trials, MRR, churned
  - `gcalConnectedCount` — count of `Business.gcalConnected = true` (capped at 100 in Testing mode)
  - Color coding: slate (0–69) → amber (70–89) → red + warning (90+)

---

## 13. Cron Jobs & Automations

| Endpoint | Schedule | Action |
|----------|----------|--------|
| `/api/cron/send-reminders` | `*/30 * * * *` (Pro) / `09:00` (Hobby) | Send pending `ScheduledMessage` records via WhatsApp |
| `/api/cron/charge-trials` | Daily `06:00` UTC | Auto-charge trial-expired businesses via Cardcom |
| `/api/cron/sync-gcal` | Hourly | Process queued `SyncJob` records → Google Calendar |

All cron endpoints require `Authorization: Bearer {CRON_SECRET}` header.

**Reminder send flow:**
1. Query `ScheduledMessage` where `status = "pending"` AND `scheduledFor <= now()`
2. For each: call `sendWhatsAppMessage()` or `sendWhatsAppTemplate()`
3. Update `status = "sent"` or `status = "failed"` with error

---

## 14. Tier / Feature Gate Enforcement

### Server-Side (all protected routes)

```typescript
// In API route:
const hasReminders = hasFeatureWithOverrides(business.tier, "whatsapp_reminders", business.featureOverrides);
if (!hasReminders) return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
```

- `hasFeature(tier, feature)` — checks tier's default feature set
- `hasFeatureWithOverrides(tier, feature, overrides)` — explicit override wins
- Limit checks: `getMaxCustomers(tier)`, `getMaxLeads(tier)`, etc.

### Client-Side (UI gating only — security is always server-side)

```typescript
const { can, cannot, tier, isFree, isPro } = usePlan();
// While loading: grants all access to prevent paywall flash

if (cannot("whatsapp_reminders")) {
  return <TierGate feature="whatsapp_reminders" />;
}
```

- `TierGate` component: shows upgrade CTA with current vs. required tier
- `usePlan()` reads `businessTier`, `businessEffectiveTier` (trial-aware), `businessFeatureOverrides`

### Tier Limits Enforcement

- `FREE` tier: 50 customers, 20 leads, 50 appointments, 4 price items, 20 tasks
- Before creating: API checks count against limit → 403 with `{ limitReached: true }` if exceeded
- Client shows `TierGate` before the creation modal opens (`cannot("feature")` check)

---

> **Generated from** API routes, lib files, and hooks — 2026-03-25.
