# Petra App — Database Schema Reference

> **Stack:** PostgreSQL via Prisma ORM (v5). Two schema files: `prisma/schema.prisma` (dev) and `prisma/schema.production.prisma` (Vercel build). They must stay in sync after every change.

---

## Table of Contents

1. [Platform Auth & Users](#1-platform-auth--users)
2. [Business / Tenancy](#2-business--tenancy)
3. [Core CRM](#3-core-crm)
4. [Appointments & Calendar](#4-appointments--calendar)
5. [Boarding](#5-boarding)
6. [Leads & CRM Pipeline](#6-leads--crm-pipeline)
7. [Orders, Payments & Invoicing](#7-orders-payments--invoicing)
8. [Training](#8-training)
9. [Service Dogs Module](#9-service-dogs-module)
10. [Messaging & Automations](#10-messaging--automations)
11. [Online Booking](#11-online-booking)
12. [Tasks](#12-tasks)
13. [Supporting / Utility Models](#13-supporting--utility-models)
14. [Entity Relationship Summary](#14-entity-relationship-summary)

---

## 1. Platform Auth & Users

### `PlatformUser`
App-wide users (can be a tenant member via `BusinessUser`).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID PK) | |
| `email` | `String` (unique) | |
| `passwordHash` | `String?` | null for Google-only accounts |
| `name` | `String` | |
| `googleId` | `String?` (unique) | Google OAuth `sub` claim |
| `authProvider` | `String` | `"local"` \| `"google"` \| `"both"` |
| `avatarUrl` | `String?` | From Google profile |
| `role` | `String` | `"USER"` \| `"MASTER"` |
| `platformRole` | `String?` | `"super_admin"` \| `"admin"` \| `"support"` \| null |
| `isActive` | `Boolean` | default `true` |
| `twoFaEnabled` | `Boolean` | default `false` |
| `twoFaSecret` | `String?` | TOTP secret (encrypted in prod) |
| `twoFaBackupCodes` | `String?` | JSON array of hashed backup codes |
| `gcalConnected` | `Boolean` | default `false` |
| `gcalAccessToken` | `String?` | encrypted at rest |
| `gcalRefreshToken` | `String?` | encrypted at rest |
| `gcalTokenExpiresAt` | `DateTime?` | |
| `gcalCalendarId` | `String?` | "Petra Bookings" calendar ID |
| `gcalSyncEnabled` | `Boolean` | default `true` |
| `tosAcceptedVersion` | `String?` | e.g. `"1.0"` |
| `tosAcceptedAt` | `DateTime?` | |
| `lastLoginAt` | `DateTime?` | updated on every login |
| `createdAt` / `updatedAt` | `DateTime` | |

**Relations:** `sessions[]`, `passwordResetTokens[]`, `businessMemberships[]`, `auditLogs[]`, `activityLogs[]`, `notifications[]`, `supportTickets[]`, `pendingApprovals[]`

---

### `AdminSession`
Server-side sessions (HttpOnly cookie, SHA-256 hashed token).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID PK) | |
| `userId` | `String` (FK → PlatformUser) | |
| `token` | `String` (unique) | 256-bit random hex |
| `twoFaVerified` | `Boolean` | default `false` |
| `ipAddress` | `String?` | |
| `userAgent` | `String?` | |
| `expiresAt` | `DateTime` | 8h regular / 30d remember-me / 30min platform admin |
| `lastSeenAt` | `DateTime` | updated every 5 min |
| `impersonatedBusinessId` | `String?` | set during super_admin impersonation |
| `impersonatedByAdminId` | `String?` | |

---

### `BusinessUser`
Tenant membership — links a `PlatformUser` to a `Business`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID PK) | |
| `businessId` | `String` (FK → Business) | |
| `userId` | `String` (FK → PlatformUser) | |
| `role` | `String` | `"owner"` \| `"manager"` \| `"user"` \| `"volunteer"` |
| `isActive` | `Boolean` | |

**Unique constraint:** `[businessId, userId]`

---

### `PasswordResetToken`
Single-use, expires after 1 hour.

| Field | Type |
|-------|------|
| `tokenHash` | `String` (unique) — SHA-256 of raw token |
| `expiresAt` | `DateTime` |
| `usedAt` | `DateTime?` |

---

### `UserConsent`
Legal evidence of ToS acceptance (one row per user per version).

| Field | Type |
|-------|------|
| `userId` | FK → PlatformUser |
| `termsVersion` | `String` |
| `acceptedAt` | `DateTime` |
| `ipAddress` / `userAgent` | `String?` |

---

### `AuditLog`
Full audit trail for all privileged platform actions.

| Field | Type |
|-------|------|
| `actorUserId` | FK → PlatformUser (nullable) |
| `action` | `String` (e.g. `"TENANT_SUSPENDED"`) |
| `targetType` | `String?` (`"business"` \| `"user"` \| etc.) |
| `targetId` | `String?` |
| `metadataJson` | `String` (JSON) |

---

### `ActivityLog`
Privacy-focused feed for Master Admin dashboard. No customer data — only action type + user identity.

| Field | Type |
|-------|------|
| `userId` | FK → PlatformUser |
| `userName` | `String` (denormalized) |
| `action` | `String` (e.g. `"LOGIN"`, `"CREATE_CUSTOMER"`) |

---

## 2. Business / Tenancy

### `Business`
Core tenant entity. Every data object belongs to a `businessId`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (UUID PK) | |
| `slug` | `String?` (unique) | e.g. `"happy-paws"` → `/book/happy-paws` |
| `name` / `phone` / `email` / `address` / `logo` | `String?` | |
| `tier` | `String` | `"free"` \| `"basic"` \| `"pro"` \| `"groomer"` \| `"service_dog"` |
| `featureOverrides` | `Json?` | Per-tenant feature flag overrides |
| `status` | `String` | `"active"` \| `"suspended"` \| `"closed"` |
| `trialEndsAt` | `DateTime?` | |
| `subscriptionEndsAt` | `DateTime?` | |
| `subscriptionStatus` | `String` | `"active"` \| `"inactive"` \| `"cancelled"` \| `"expired"` |
| `cardcomDealId` | `String?` | Last successful Cardcom deal number |
| `cardcomToken` | `String?` | Recurring billing token |
| `cardcomTokenExpiry` | `String?` | Card expiry in MMYY format |
| `vatEnabled` | `Boolean` | default `true` |
| `vatRate` | `Float` | default `0.17` |
| `boardingCalcMode` | `String` | `"nights"` (default) |
| `boardingMinNights` | `Int` | default `1` |
| `boardingCheckInTime` / `boardingCheckOutTime` | `String` | HH:MM |
| `boardingPricePerNight` | `Float` | default `150` |
| `bookingBuffer` | `Int` | Minutes between appointments |
| `bookingMinNotice` | `Int` | Min hours before slot can be booked |
| `bookingMaxAdvance` | `Int` | Max days ahead — default `60` |
| `gcalBlockExternal` | `Boolean` | Block any GCal event (not just Petra ones) |
| `customerTags` | `String` | JSON array of preset tag labels |
| `timezone` | `String` | default `"Asia/Jerusalem"` |
| `webhookApiKey` | `String?` (unique) | Per-business webhook key (`pk_...`) |
| `sdSettings` | `Json?` | Service dog org settings |
| `whatsappRemindersEnabled` | `Boolean` | default `false` |
| `whatsappReminderLeadHours` | `Int` | default `48` |
| `googleContactsSync` | `Boolean` | default `false` |
| `cancellationPolicy` | `String?` | Shown in booking wizard |
| `bookingWelcomeText` | `String?` | Greeting on public booking page |

**Relations (50+):** members, customers, services, appointments, boardingStays, rooms, leads, payments, messageTemplates, automationRules, tasks, orders, bookings, trainingPrograms, serviceDogProfiles, serviceDogRecipients, serviceDogPlacements, availabilityRules, invoicingSettings, etc.

---

### `User` (Legacy)
Tenant-scoped staff model — kept for backwards compatibility.

| Field | Type |
|-------|------|
| `email` | `String` (unique) |
| `passwordHash` | `String` |
| `role` | `String` (`"staff"`) |
| `businessId` | FK → Business |

---

## 3. Core CRM

### `Customer`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `name` | `String` | |
| `phone` | `String` | |
| `phoneNorm` | `String?` | Normalized to `05X-XXXXXXX` |
| `email` | `String?` | |
| `address` | `String?` | |
| `idNumber` | `String?` | תעודת זהות (PII — `CUSTOMERS_PII` permission required) |
| `notes` | `String?` | |
| `tags` | `String` | JSON array |
| `documents` | `String` | JSON array of file URLs |
| `source` | `String?` | Referral source |
| `businessId` | FK → Business | |

**Relations:** `pets[]`, `appointments[]`, `boardingStays[]`, `payments[]`, `timelineEvents[]`, `leads[]`, `orders[]`, `bookings[]`, `trainingPrograms[]`

---

### `Pet`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `name` | `String` | |
| `species` | `String` | default `"dog"` |
| `breed` | `String?` | |
| `birthDate` | `DateTime?` | |
| `weight` | `Float?` | |
| `gender` | `String?` | |
| `microchip` | `String?` | |
| `color` | `String?` | |
| `isNeutered` | `Boolean?` | |
| `medicalNotes` / `foodNotes` / `behaviorNotes` | `String?` | |
| `foodBrand` / `foodGramsPerDay` / `foodFrequency` | mixed | |
| `tags` | `String` | JSON array |
| `attachments` | `String` | JSON array |
| `customerId` | `String?` | **NULLABLE** — always optional-chain |
| `businessId` | `String?` | Set for standalone service dogs |

**Relations:** `appointments[]`, `boardingStays[]`, `health` (one-to-one), `behavior` (one-to-one), `medications[]`, `serviceDogProfile` (one-to-one), `weightHistory[]`

---

### `PetWeightEntry`
Weight tracking history for a pet.

| Field | Type |
|-------|------|
| `petId` | FK → Pet |
| `weight` | `Float` |
| `recordedAt` | `DateTime` |

---

### `TimelineEvent`
Activity log per customer. **No `title` field** — use `description` + `type` only.

| Field | Type |
|-------|------|
| `type` | `String` |
| `description` | `String` |
| `metadata` | `String?` (JSON) |
| `customerId` | `String?` FK → Customer |
| `businessId` | FK → Business |

---

## 4. Appointments & Calendar

### `Service`
Service catalog for a business.

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | |
| `type` | `String` | |
| `duration` | `Int` | Minutes, default `60` |
| `price` | `Float` | |
| `includesVat` | `Boolean` | |
| `color` | `String?` | Calendar color |
| `isActive` | `Boolean` | |
| `isPublicBookable` | `Boolean` | Expose to online booking |
| `depositRequired` | `Boolean` | |
| `depositAmount` | `Float?` | |
| `bufferBefore` / `bufferAfter` | `Int` | Minutes |
| `bookingMode` | `String` | `"automatic"` \| `"requires_approval"` |
| `paymentUrl` | `String?` | Payment landing page |

---

### `Appointment`
Internal calendar entries.

| Field | Type | Notes |
|-------|------|-------|
| `date` | `DateTime` | |
| `startTime` / `endTime` | `String` | `"HH:MM"` |
| `status` | `String` | `"scheduled"` \| `"completed"` \| `"cancelled"` |
| `serviceId` | `String?` FK → Service | |
| `priceListItemId` | `String?` FK → PriceListItem | |
| `customerId` | FK → Customer | |
| `petId` | `String?` FK → Pet | |
| `staffId` | `String?` FK → User | |
| `gcalEventId` | `String?` | GCal event ID |

**Relations:** `payments[]`

---

## 5. Boarding

### `Room`

| Field | Type |
|-------|------|
| `name` | `String` |
| `capacity` | `Int` (default 1) |
| `type` | `String` (`"standard"`) |
| `status` | `String` (`"available"` \| `"needs_cleaning"`) |
| `pricePerNight` | `Float?` |
| `sortOrder` | `Int` |

---

### `BoardingStay`

| Field | Type | Notes |
|-------|------|-------|
| `checkIn` | `DateTime` | |
| `checkOut` | `DateTime?` | nullable until checkout |
| `feedingPlan` / `medicalNeeds` / `notes` | `String?` | |
| `dailyTrainingMinutes` | `Int?` | |
| `status` | `String` | `"reserved"` \| `"checked_in"` \| `"checked_out"` |
| `roomId` | `String?` FK → Room | |
| `petId` | FK → Pet | |
| `customerId` | `String?` FK → Customer | |
| `bookingId` | `String?` (unique) | Link to originating online booking |
| `gcalEventId` | `String?` | |

**Relations:** `payments[]`, `careLogs[]`

---

### `BoardingCareLog`
Daily care entries per pet during a boarding stay.

| Field | Type | Notes |
|-------|------|-------|
| `boardingStayId` | FK → BoardingStay (cascade delete) | |
| `petId` | FK → Pet | |
| `type` | `String` | `"FEEDING"` \| `"MEDICATION"` \| `"WALK"` \| `"NOTE"` |
| `title` | `String` | |
| `doneAt` | `DateTime` | |
| `doneByUserId` | `String?` | |

---

## 6. Leads & CRM Pipeline

### `Lead`

| Field | Type | Notes |
|-------|------|-------|
| `name` / `phone` / `email` / `city` | mixed | |
| `requestedService` | `String?` | |
| `source` | `String` | default `"manual"` |
| `stage` | `String` | **UUID from `LeadStage` table** — never hardcoded |
| `notes` | `String?` | |
| `customerId` | `String?` FK → Customer | Set when lead converts |
| `lastContactedAt` | `DateTime?` | |
| `wonAt` / `wonByUserId` | mixed | |
| `lostAt` / `lostByUserId` | mixed | |
| `lostReasonCode` | `String?` | `PRICE` \| `COMPETITOR` \| `SCHEDULING` \| `TRUST_FIT` \| `NO_RESPONSE` \| `NOT_RELEVANT` \| `OTHER` |
| `nextFollowUpAt` | `DateTime?` | |
| `followUpStatus` | `String` | `"pending"` \| `"completed"` |
| `googleContactId` | `String?` | Google People API resource name |
| `previousStageId` | `String?` | Last active stage before archiving |

**Relations:** `callLogs[]`

---

### `LeadStage`
Business-specific custom pipeline stages. **Do not hardcode stage names — always query this table.**

| Field | Type |
|-------|------|
| `name` | `String` |
| `color` | `String` (default `"#6366F1"`) |
| `sortOrder` | `Int` |
| `isWon` | `Boolean` |
| `isLost` | `Boolean` |

---

### `CallLog`
Contact history per lead.

| Field | Type |
|-------|------|
| `type` | `String` (`"call"` \| `"stage_change"`) |
| `summary` | `String` |
| `treatment` | `String` |

---

## 7. Orders, Payments & Invoicing

### `PriceList` / `PriceListItem`
Service catalog with pricing.

**PriceListItem fields:**

| Field | Type | Notes |
|-------|------|-------|
| `type` | `String` | `"service"` \| `"product"` \| etc. |
| `name` | `String` | |
| `unit` | `String` | `"per_session"` \| `"per_night"` \| etc. |
| `basePrice` | `Float` | |
| `taxMode` | `String` | `"inherit"` \| `"included"` \| `"excluded"` |
| `durationMinutes` | `Int?` | |
| `sessions` | `Int?` | For training packages |
| `isBookableOnline` | `Boolean` | |
| `depositRequired` | `Boolean` | |
| `maxBookingsPerDay` | `Int?` | Capacity limit |
| `paymentUrl` | `String?` | |

---

### `Order`

| Field | Type | Notes |
|-------|------|-------|
| `status` | `String` | `"draft"` \| `"open"` \| `"paid"` \| `"cancelled"` |
| `orderType` | `String` | `"sale"` |
| `startAt` / `endAt` | `DateTime?` | Used for calendar filter (`startFrom`/`startTo` params) |
| `subtotal` / `discountAmount` / `taxTotal` / `total` | `Float` | |
| `discountType` | `String` | `"none"` \| `"percent"` \| `"fixed"` |
| `relatedEntityType` | `String?` | `"Appointment"` \| `"BoardingStay"` \| `"TrainingProgram"` |
| `relatedEntityId` | `String?` | |

**Relations:** `lines[]` (OrderLine), `payments[]`, `invoiceDocuments[]`

---

### `OrderLine`

| Field | Type |
|-------|------|
| `priceListItemId` | `String?` FK → PriceListItem |
| `name` | `String` |
| `quantity` / `unitPrice` / `lineSubtotal` / `lineTax` / `lineTotal` | `Float` |

---

### `Payment`

| Field | Type | Notes |
|-------|------|-------|
| `amount` | `Float` | |
| `method` | `String` | `"cash"` \| `"credit"` \| `"transfer"` \| `"check"` |
| `status` | `String` | `"pending"` \| `"completed"` \| `"refunded"` |
| `isDeposit` | `Boolean` | |
| `appointmentId` | `String?` FK → Appointment | |
| `boardingStayId` | `String?` FK → BoardingStay | |
| `orderId` | `String?` FK → Order | |
| `customerId` | FK → Customer | |
| `paidAt` | `DateTime?` | |

> **Always optional-chain:** `payment.appointment?.service?.name`

---

### Invoicing Models

- **`InvoicingSettings`** — Provider config (Morning/iCount/Rivhit) per business
- **`InvoiceJob`** — Invoice generation queue (links payment + customer)
- **`InvoiceDocument`** — Generated document record with provider document ID
- **`StripeSettings`** — Stripe secret key (encrypted) per business
- **`SubscriptionEvent`** — Billing event log (trial started, charged, cancelled)

---

## 8. Training

### `TrainingPackage`
Sellable training packages (defines sessions/price/type).

| Field | Type | Notes |
|-------|------|-------|
| `type` | `String` | `"HOME"` \| `"BOARDING"` \| `"GROUP"` \| `"WORKSHOP"` |
| `sessions` | `Int` | Included session count |
| `durationDays` | `Int?` | For BOARDING packages |
| `price` | `Float` | |

---

### `TrainingProgram`
Per-dog training plan.

| Field | Type | Notes |
|-------|------|-------|
| `dogId` | FK → Pet | |
| `customerId` | `String?` FK → Customer | |
| `packageId` | `String?` FK → TrainingPackage | |
| `programType` | `String` | `BASIC_OBEDIENCE` \| `REACTIVITY` \| `PUPPY` \| `BEHAVIOR` \| `ADVANCED` \| `CUSTOM` |
| `trainingType` | `String` | `"HOME"` \| `"BOARDING"` \| `"SERVICE_DOG"` |
| `status` | `String` | `"ACTIVE"` \| `"PAUSED"` \| `"COMPLETED"` \| `"CANCELED"` |
| `totalSessions` | `Int?` | Planned sessions |
| `sessionsCompleted` | `Int` | Counter |
| `price` | `Float?` | |
| `priceListItemId` | `String?` | |
| `orderId` | `String?` | |
| `homeworkNotes` | `String?` | |
| `trainerNotes` | `String?` | |

**Relations:** `sessions[]` (TrainingSession), `goals[]` (TrainingGoal)

---

### `TrainingSession`
Individual lesson record.

| Field | Type |
|-------|------|
| `sessionDate` | `DateTime` |
| `duration` | `Int` (minutes) |
| `status` | `String` (`"PLANNED"` \| `"COMPLETED"` \| `"MISSED"`) |
| `trainerNotes` | `String?` |
| `homeworkGiven` | `String?` |
| `nextSessionGoals` | `String?` |

---

### `TrainingGroup`
Group training class.

| Field | Type |
|-------|------|
| `name` | `String` |
| `type` | `String` |
| `maxParticipants` | `Int` |
| `status` | `String` |
| `schedule` | `String?` (JSON) |

**Relations:** `participants[]` (TrainingGroupParticipant — many-to-many with Customer+Pet)

---

## 9. Service Dogs Module

### `ServiceDogProfile`
Core service dog record. One-to-one with `Pet`.

| Field | Type | Notes |
|-------|------|-------|
| `petId` | `String` (unique) FK → Pet | |
| `phase` | `String` | Single source of truth: `SERVICE_DOG_PHASES` in `service-dogs.ts` |
| `dogType` | `String` | `MOBILITY` \| `PSYCHIATRIC` \| `PTSD` \| `GUIDE` \| `AUTISM` \| `ALERT` \| `OTHER` |
| `trainingTests` | `Json?` | Array of test result objects |
| `medicalProtocols` | `Json?` | Key-value protocol completion state |
| `certificationDate` | `DateTime?` | |
| `certificationExpiry` | `DateTime?` | |
| `certificationBody` | `String?` | |
| `isActive` | `Boolean` | |
| `internalNotes` | `String?` | |
| `fundingSource` | `String?` | |
| `estimatedCertDate` | `DateTime?` | |
| `targetHours` | `Int?` | |
| `totalTrainingHours` | `Float` | |

**Phase order:** `SELECTION → RAISING → PUPPY → IN_TRAINING → ADVANCED_TRAINING → CERTIFIED → RETIRED → DECERTIFIED`

---

### `ServiceDogRecipient`
Beneficiary profile.

| Field | Type | Notes |
|-------|------|-------|
| `customerId` | `String?` FK → Customer | Optional link to existing customer |
| `stage` | `String` | UUID from `ServiceRecipientStage` |
| `disabilityType` | `String?` | Sensitive — `RECIPIENTS_SENSITIVE` permission |
| `fundingSource` | `String?` | |
| `approvalStatus` | `String` | |
| `approvalDate` | `DateTime?` | |
| `waitingListDate` | `DateTime?` | |
| `meetings` | `Json?` | Array of meeting records |

---

### `ServiceDogPlacement`
Active assignment of a dog to a recipient.

| Field | Type | Notes |
|-------|------|-------|
| `serviceDogId` | FK → ServiceDogProfile | |
| `recipientId` | FK → ServiceDogRecipient | |
| `status` | `String` | **Only `"ACTIVE"` or `"TERMINATED"`** |
| `placedAt` | `DateTime` | |
| `terminatedAt` | `DateTime?` | |
| `terminationReason` | `String?` | |

---

### `ServiceRecipientStage`
Custom kanban stages for the recipient pipeline. Auto-upserted by `GET /api/service-recipient-stages`. `REJECTED` = archive stage, hidden by default.

---

### Medical / Health Models

- **`DogHealth`** — Vaccine dates, deworming dates (`dewormingValidUntil`, `parkWormValidUntil`), vet clearance
- **`DogBehavior`** — Behavior assessment scores
- **`DogMedication`** — Active medications with dosage
- **`ServiceDogMedicalProtocol`** — Protocol compliance records
- **`ServiceDogTrainingLog`** — Hour logging per session
- **`ServiceDogComplianceEvent`** — Compliance tracking events
- **`ServiceDogIDCard`** — ID card generation records
- **`ServiceDogMilestone`** — Achievement milestones
- **`ServiceDogEvaluation`** — Formal evaluations
- **`ServiceDogInsurance`** / **`ServiceDogClaim`** — Insurance tracking
- **`ServiceDogVest`** — Vest issue tracking

---

## 10. Messaging & Automations

### `MessageTemplate`

| Field | Type | Notes |
|-------|------|-------|
| `name` | `String` | |
| `channel` | `String` | `"whatsapp"` \| `"email"` |
| `subject` | `String?` | Email only |
| `body` | `String` | Supports placeholders: `{customerName}`, `{petName}`, `{date}`, `{time}`, `{serviceName}`, `{businessPhone}`, `{paymentUrl}`, `{orderTotal}` |
| `variables` | `String` | JSON array |
| `isActive` | `Boolean` | |

---

### `AutomationRule`
Event-based messaging triggers.

| Field | Type | Notes |
|-------|------|-------|
| `trigger` | `String` | e.g. `"on_appointment"`, `"payment_request"` |
| `triggerOffset` | `Int` | Hours offset (default `48`) |
| `templateId` | FK → MessageTemplate | |
| `isActive` | `Boolean` | |

---

### `ScheduledMessage`
Queued outbound messages (consumed by cron).

| Field | Type |
|-------|------|
| `channel` | `String` |
| `recipient` | `String` (phone/email) |
| `body` | `String` |
| `scheduledFor` | `DateTime` |
| `status` | `String` (`"pending"` \| `"sent"` \| `"failed"`) |
| `customerId` | `String?` |

---

### `Notification`
In-app per-user notifications.

| Field | Type |
|-------|------|
| `userId` | FK → PlatformUser |
| `title` / `message` | `String` |
| `isRead` | `Boolean` |
| `actionUrl` | `String?` |

---

## 11. Online Booking

### `AvailabilityRule`
Weekly working hours (one per day of week per business). Unique on `[businessId, dayOfWeek]`.

### `AvailabilityBlock`
Manual time-off blocks (vacations, sick days).

### `AvailabilityBreak`
Daily break windows (lunch, prayer). `dayOfWeek = -1` = every day.

### `Booking`
Public-facing online booking (separate from internal `Appointment`).

| Field | Type | Notes |
|-------|------|-------|
| `priceListItemId` | `String?` FK | New bookings via price list |
| `serviceId` | `String?` FK | Legacy bookings only |
| `startAt` / `endAt` | `DateTime` | UTC |
| `status` | `String` | `"pending"` \| `"confirmed"` \| `"declined"` \| `"cancelled"` |
| `depositPaid` | `Boolean` | |
| `source` | `String` | `"online"` \| `"manual"` |
| `customerToken` | `String?` (unique) | For "My Booking" self-service |
| `gcalSyncStatus` | `String` | `"disabled"` \| `"pending"` \| `"synced"` \| `"failed"` |

**Relations:** `dogs[]` (BookingDog — M:M with Pet), `syncJobs[]`, `boardingStay` (one-to-one)

---

### `SyncJob`
Background queue for Google Calendar sync operations.

| Field | Type |
|-------|------|
| `action` | `String` (`"create"` \| `"update"` \| `"delete"`) |
| `status` | `String` (`"queued"` \| `"processing"` \| `"done"` \| `"failed"`) |
| `attempts` | `Int` |
| `nextRunAt` | `DateTime` |

---

## 12. Tasks

### `Task`

| Field | Type | Notes |
|-------|------|-------|
| `category` | `String` | `BOARDING` \| `TRAINING` \| `LEADS` \| `GENERAL` \| `HEALTH` \| `MEDICATION` \| `FEEDING` |
| `priority` | `String` | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` |
| `status` | `String` | `OPEN` \| `COMPLETED` \| `CANCELED` |
| `dueAt` | `DateTime?` | Specific time |
| `dueDate` | `DateTime?` | All-day tasks |
| `assigneeUserId` | `String?` FK → User | |
| `relatedEntityType` | `String?` | `BUSINESS` \| `CUSTOMER` \| `DOG` \| `LEAD` \| etc. |
| `relatedEntityId` | `String?` | |
| `templateId` | `String?` FK → TaskTemplate | |
| `recurrenceRuleId` | `String?` FK → TaskRecurrenceRule | |

---

### `TaskRecurrenceRule`
iCal RRULE-based recurring task generation.

| Field | Type |
|-------|------|
| `rrule` | `String` (iCal, e.g. `"FREQ=DAILY;INTERVAL=1"`) |
| `timezone` | `String` |
| `startAt` / `endAt` | `DateTime?` |
| `lastGeneratedAt` | `DateTime?` |
| `isActive` | `Boolean` |

---

## 13. Supporting / Utility Models

| Model | Purpose |
|-------|---------|
| `PendingApproval` | Manager actions awaiting owner approval |
| `ContractTemplate` / `ContractRequest` | Digital contract generation |
| `IntakeForm` | New client questionnaire |
| `OnboardingProfile` | User onboarding answers |
| `OnboardingProgress` | Step-by-step onboarding tracker |
| `ImportBatch` / `ImportRowIssue` | CSV import with rollback support |
| `SystemMessage` | Business-wide broadcast banners |
| `SupportTicket` | In-app bug reports |
| `FeatureFlag` | Platform-level feature flags (key/value) |
| `IpWhitelist` | Platform admin IP restrictions |

---

## 14. Entity Relationship Summary

```
PlatformUser ─── M:M ──► Business  (via BusinessUser)
Business ────── 1:M ──► Customer
                1:M ──► Pet  (standalone service dogs only)
                1:M ──► Service
                1:M ──► Appointment
                1:M ──► BoardingStay
                1:M ──► Order
                1:M ──► Payment
                1:M ──► Lead ──── M:1 ──► LeadStage
                1:M ──► Task
                1:M ──► MessageTemplate
                1:M ──► AutomationRule
                1:M ──► Booking
                1:M ──► ServiceDogProfile
                1:M ──► ServiceDogRecipient
                1:M ──► ServiceDogPlacement
                1:M ──► TrainingProgram
                1:M ──► TrainingGroup

Customer ──── 1:M ──► Pet
              1:M ──► Appointment
              1:M ──► BoardingStay
              1:M ──► Payment
              1:M ──► Order
              1:M ──► TimelineEvent
              1:M ──► Lead

Pet ─── 1:1 ──► DogHealth
        1:1 ──► DogBehavior
        1:1 ──► ServiceDogProfile
        1:M ──► DogMedication
        1:M ──► PetWeightEntry
        1:M ──► BoardingCareLog

Appointment ─── M:1 ──► Service
                M:1 ──► Customer
                M:1 ──► Pet?
                1:M ──► Payment

Order ─── 1:M ──► OrderLine ──── M:1 ──► PriceListItem
          1:M ──► Payment
          1:M ──► InvoiceDocument

Booking ─── M:M ──► Pet (via BookingDog)
            1:1 ──► BoardingStay (optional)
            1:M ──► SyncJob

ServiceDogProfile ─── M:1 ──► Pet
ServiceDogPlacement ─── M:1 ──► ServiceDogProfile
                        M:1 ──► ServiceDogRecipient

TrainingProgram ─── M:1 ──► Pet (dogId)
                    M:1 ──► TrainingPackage?
                    1:M ──► TrainingSession
                    1:M ──► TrainingGoal
TrainingGroup ─── M:M ──► Customer + Pet (via TrainingGroupParticipant)
```

---

> **Generated from** `prisma/schema.prisma` — last updated 2026-03-25.
