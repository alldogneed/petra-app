# Lead-Rescue Discovery — Existing System Inventory

Read-only survey of the Petra codebase as of branch `feature/workshops-ops` (2026-08-07).
Every claim below is anchored to a file path and line range. Where something does not
exist, it is stated as **not found** rather than inferred.

---

## 1. Sales Module — Data Model

### 1.1 Where the module lives

There is no separate "sales" module. Leads are a first-class Prisma model plus a set of
API routes:

- Schema: `prisma/schema.prisma:594-662` (`Lead`, `LeadStage`, `CallLog`)
- Service layer: `src/services/clients.ts:538-841` (leads section, co-located with customers/tasks)
- Routes: `src/app/api/leads/**`
- UI: `src/app/(dashboard)/leads/page.tsx`, `src/components/leads/LeadTreatmentModal.tsx`

### 1.2 Tables and columns

**`Lead`** — `prisma/schema.prisma:594-631`

| Column | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `name` | `String` | required |
| `phone` | `String?` | nullable, **stored raw as entered** (see §2) |
| `email` | `String?` | |
| `city` | `String?` | |
| `address` | `String?` | |
| `requestedService` | `String?` | free text |
| `source` | `String @default("manual")` | free string, not an enum |
| `stage` | `String @default("new")` | **holds a `LeadStage.id` UUID**, not a keyword |
| `notes` | `String?` | free text |
| `customerId` | `String?` | FK to `Customer` |
| `businessId` | `String` | FK to `Business` |
| `lastContactedAt` | `DateTime?` | |
| `wonAt` | `DateTime?` | |
| `wonByUserId` | `String?` | column exists |
| `lostAt` | `DateTime?` | |
| `lostByUserId` | `String?` | column exists |
| `lostReasonCode` | `String?` | |
| `lostReasonText` | `String?` | |
| `nextFollowUpAt` | `DateTime?` | |
| `followUpStatus` | `String @default("pending")` | `"pending" \| "completed"` per inline comment |
| `followUpTaskId` | `String?` | id of an auto-created `Task` |
| `googleContactId` | `String?` | Google People API resource name |
| `previousStageId` | `String?` | last active stage before won/lost, for restore |
| `createdAt`, `updatedAt` | `DateTime` | |

Indexes: `[businessId, lastContactedAt]`, `[stage, lostReasonCode, createdAt]`,
`[businessId, stage]` — `prisma/schema.prisma:628-630`.

`wonByUserId` / `lostByUserId` are declared but **never written anywhere in `src/`** — a
repo-wide grep for both identifiers returns no hits outside the schema file. They are dead
columns today.

**`LeadStage`** — `prisma/schema.prisma:634-648`

`id`, `businessId`, `name`, `color` (`@default("#6366F1")`), `sortOrder Int`,
`isWon Boolean @default(false)`, `isLost Boolean @default(false)`, `createdAt`, `updatedAt`.
Index `[businessId, sortOrder]`.

**`CallLog`** — `prisma/schema.prisma:650-662`

`id`, `leadId` (FK, `onDelete: Cascade`), `type String @default("call")`,
`summary String`, `treatment String @default("")`, `createdAt`, `updatedAt`.
Index `[leadId, createdAt]`.

### 1.3 Lead status field and its value set

The field is **`Lead.stage`** (`prisma/schema.prisma:604`). Its type is `String` and it
holds a **`LeadStage.id` UUID**, per-business. There is **no database enum and no
application-level enum of stage values.**

The `@default("new")` on the column is vestigial — every real write resolves a stage id:

- `createLead` validates `input.stage` against `LeadStage` rows for the business, or calls
  `getFirstLeadStageId(businessId)` — `src/services/clients.ts:668-675`
- Webhook path calls `getFirstLeadStageId` — `src/app/api/webhooks/lead/route.ts:150,159`
- PayCall path uses the `PAYCALL_NEW_LEAD_STAGE_ID` env var — `src/lib/paycall.ts:143,181`

The **seed set** of stages (not an enum — rows inserted per business, editable/renamable/
deletable through the UI) is `DEFAULT_LEAD_STAGES` in `src/lib/lead-stages.ts:9-17`:

| # | name | color | isWon | isLost |
|---|---|---|---|---|
| 0 | ליד חדש | `#94A3B8` | false | false |
| 1 | יצירת קשר | `#6366F1` | false | false |
| 2 | ייעוץ ראשוני | `#F59E0B` | false | false |
| 3 | הצעת מחיר | `#3B82F6` | false | false |
| 4 | ממתין להחלטה | `#8B5CF6` | false | false |
| 5 | לקוח | `#10B981` | **true** | false |
| 6 | אבד | `#EF4444` | false | **true** |

`ensureDefaultStages()` (`src/lib/lead-stages.ts:20-53`) creates these only when the
business has zero stages, and additionally back-fills a won and a lost stage for older
businesses. `GET /api/leads/stages` calls it on every request
(`src/app/api/leads/stages/route.ts:12`).

Note two other routes independently auto-create a won/lost stage with a *different* name
("נסגר בהצלחה" instead of "לקוח") if none is found:
`src/app/api/leads/[id]/convert/route.ts:49-61`, `src/app/api/leads/[id]/close-won/route.ts:29-41`.

The one genuinely enumerated lead field is the **lost reason**: `LOST_REASON_CODES` in
`src/lib/constants.ts:86-95` — `PRICE`, `COMPETITOR`, `SCHEDULING`, `TRUST_FIT`,
`NO_RESPONSE`, `NOT_RELEVANT`, `LOCATION`, `OTHER`. Enforced in
`src/app/api/leads/[id]/close-lost/route.ts:27-33`. The schema comment at
`prisma/schema.prisma:614` lists a slightly stale subset (no `LOCATION`).

### 1.4 Status-transition timestamps and history

**Current status only** on the row. There is **no status-history / audit table for leads.**
The only transition timestamps stored on `Lead` are the terminal ones:

- `wonAt` / `lostAt`, auto-stamped in `updateLead` when the new stage's `isWon`/`isLost`
  flips — `src/services/clients.ts:737-747`
- `lastContactedAt`, written only by PayCall (`src/lib/paycall.ts:171-174`) and by explicit
  client PATCH (`src/services/clients.ts:783`)

There is **no `stageChangedAt`, no `previousStage` timestamp, and no per-transition row.**
`previousStageId` (`prisma/schema.prisma:620`) stores only the single last active stage
before archiving.

The nearest thing to history is a `CallLog` row of `type: "stage_change"`, written
**client-side and best-effort** after a Kanban drag:
`src/app/(dashboard)/leads/page.tsx:1501-1503` and
`src/components/leads/LeadTreatmentModal.tsx:526`. Nothing on the server writes a
stage-change log, so any stage update made through `PATCH /api/leads/[id]` directly
(including via the API) leaves no trace.

`TimelineEvent` (`prisma/schema.prisma:824-835`) is keyed on `customerId`, **not** on
`leadId` — it cannot record lead-stage history. `ActivityLog` (`:170-182`) and `AuditLog`
(`:146-168`) record `UPDATE_LEAD` as an action name only, without the field-level diff:
`src/app/api/leads/[id]/route.ts:58`.

### 1.5 Lead → client linkage on conversion

Two mechanisms exist, both writing `Lead.customerId`:

1. **`POST /api/leads/[id]/convert`** — `src/app/api/leads/[id]/convert/route.ts:15-116`.
   Finds/creates the won stage, reuses `lead.customerId` if set, otherwise
   `prisma.customer.create` from `lead.name / phone / email / notes / source`
   (`:70-80`), writes a `TimelineEvent` `type: "customer_created"` (`:83-90`), then sets
   `stage = wonStage.id`, `wonAt = now()`, `customerId` (`:94-101`).

2. **`POST /api/leads/[id]/close-won`** — `src/app/api/leads/[id]/close-won/route.ts:7-111`.
   Near-duplicate logic; if `existing.customerId` is already set it only bumps the stage
   (`:52-66`), otherwise creates the customer (`:69-78`) and writes a
   `TimelineEvent` `type: "lead_converted"` (`:90-97`).

Both bypass `createCustomer` in the service layer and therefore **do not populate
`Customer.phoneNorm`** — see §2.3.

`Customer.leads Lead[]` back-relation: `prisma/schema.prisma:361`.

### 1.6 Dog fields at the lead stage

**Not found as structured fields.** `Lead` has no breed, age, dog-name, or
presenting-problem column. The only structured lead field carrying intent is
`requestedService String?` (`prisma/schema.prisma:600`), free text.

Dog data arriving at lead time is flattened into `Lead.notes` as Hebrew-labelled lines by
the webhook — `src/app/api/webhooks/lead/route.ts:139-146`:

```
עיר: …
שירות מבוקש: …
שם כלב: …
גזע: …
```

so `petName` and `petBreed`/`breed` submitted by an external form become unparsed prose.

Structured dog data exists only **after** a `Pet` row exists — i.e. post-conversion:

- `Pet` — `prisma/schema.prisma:376-418`: `breed`, `birthDate`, `weight`, `gender`,
  `microchip`, `color`, `isNeutered`, `medicalNotes`, `behaviorNotes`
- `DogHealth` — `:1560-1606`: vaccination dates, allergies, `medicalConditions`, vet contact
- `DogBehavior` — `:1608-1636`: 13 boolean presenting problems (`dogAggression`,
  `humanAggression`, `leashReactivity`, `separationAnxiety`, `biteHistory`, …) plus
  `triggers`, `biteDetails`, `customIssues`
- `DogMedication` — `:1638-1659`

These hang off `Pet.id`, and `Pet.customerId` is nullable
(`prisma/schema.prisma:398`). `IntakeForm` (`:1532-1558`) — the mechanism that populates
`DogHealth`/`DogBehavior` — is keyed on `customerId`/`dogId`, both nullable, and has **no
`leadId` column**.

### 1.7 Activity / note / touchpoint log per lead

**Yes — `CallLog`**, `prisma/schema.prisma:650-662`. One row per touchpoint, FK `leadId`,
cascade-deleted with the lead.

Columns: `type` (`"call" | "stage_change"`, per the inline comment at `:656` and the
allowlist at `src/app/api/leads/[id]/logs/route.ts:51`), `summary String`,
`treatment String @default("")`, `createdAt`.

Writers — three, all doing `prisma.callLog.create`:

| Writer | File:line | Actor |
|---|---|---|
| `POST /api/leads/[id]/call-logs` | `src/app/api/leads/[id]/call-logs/route.ts:80` | logged-in user (session) |
| `POST /api/leads/[id]/logs` | `src/app/api/leads/[id]/logs/route.ts:88` | logged-in user (session); accepts `type` |
| `processMissedCall` (PayCall) | `src/lib/paycall.ts:191` | machine, via webhook/cron |

Readers: `GET /api/leads/[id]/call-logs` and `GET /api/leads/[id]/logs` — identical
implementations (`call-logs/route.ts:6-37`, `logs/route.ts:6-37`); plus `listLeads`
includes `callLogs` inline (`src/services/clients.ts:556`).

`CallLog` has **no `userId` / author column** — you cannot tell which staff member logged a
touchpoint. It also has no direction, channel, or outcome field.

---

## 2. Phone Numbers

### 2.1 Storage — several formats, no single canonical one

All phone columns are plain `String`/`String?`. There is no DB-level constraint or format.

| Column | Schema | Format actually written | Example shape |
|---|---|---|---|
| `Customer.phone` | `prisma/schema.prisma:339` (`String`, required) | display-normalized with a dash by `createCustomer` | `05X-XXXXXXX` |
| `Customer.phoneNorm` | `:340` (`String?`) | digits, country code, **no `+`** | `9725XXXXXXXX` |
| `Lead.phone` | `:597` (`String?`) | **raw, exactly as submitted** — no normalization on write | `05X-XXXXXXX`, `+972-5X-XXX-XXXX`, `05XXXXXXXX`, … |
| `Customer.secondContactPhone` | `:344` (`String?`) | raw | — |
| `Business.phone` | `:212` (`String?`) | raw | — |
| `IntakeForm.phoneE164` | `:1543` (`String?`) | true E.164 with `+` | `+9725XXXXXXXX` |
| `DogHealth.vetPhone` | `:1596` (`String?`) | raw | — |

`createLead` writes `phone: input.phone ?? undefined` with no transform
(`src/services/clients.ts:687`); `updateLead` likewise (`:775`). Validation only —
`validateIsraeliPhone` at `:632-635` / `:758-761` — never rewriting. The webhook stores
`str(body.phone).slice(0, 50)` verbatim (`src/app/api/webhooks/lead/route.ts:123,157`).

`createCustomer` **does** normalize: `phone: normalizedPhone, phoneNorm`
(`src/services/clients.ts:411`).

### 2.2 Normalization helpers — five, with three different output formats

| Helper | File:line | Output |
|---|---|---|
| `normalizeIsraeliPhone` | `src/lib/validation.ts:14-30` | local display, dashed — `05X-XXXXXXX` |
| `normalizeIsraeliPhone` (**same name, different semantics**) | `src/lib/paycall.ts:123-128` | local, no dash — `05XXXXXXXX` |
| `phoneToNorm` (customers) | `src/services/clients.ts:29-39` | digits — `9725XXXXXXXX` |
| `leadPhoneToNorm` (leads) | `src/services/clients.ts:541-551` | digits — `9725XXXXXXXX` |
| `normalizePhone` (CSV import) | `src/lib/import-utils.ts:18-47` | E.164 — `+9725XXXXXXXX` |
| `normalizePhoneIL` (intake) | `src/lib/intake.ts:25-38` | E.164 — `+9725XXXXXXXX` |
| `toWhatsAppPhone` | `src/lib/utils.ts:79-84` | wa digits — `9725XXXXXXXX` |

There is **no single shared E.164 helper.** `phoneToNorm` and `leadPhoneToNorm` are
byte-identical logic duplicated in the same file (lines 29-39 and 541-551), except
`phoneToNorm` falls back to `digits || null` while `leadPhoneToNorm` returns `null` — so
they diverge on malformed input.

`src/lib/paycall.ts:123` shadows the `validation.ts` export name with a function that
returns a *different* format. Any code importing `normalizeIsraeliPhone` gets one of two
incompatible results depending on the import path.

### 2.3 Same person as both lead and client, with different formats

**Yes, this is possible today**, and there is partial detection but no dedupe.

What exists — read-time duplicate *flagging*:

- `listLeads` (`src/services/clients.ts:553-596`) maps each lead's `phone` through
  `leadPhoneToNorm`, batch-queries `Customer` by `phoneNorm IN (...)` (`:571-574`), and
  attaches `existingCustomer` and `duplicateLead` to each returned lead (`:589-595`).
- `createLead` runs the same check before insert and returns `existingCustomer` /
  `duplicateLead` in the 201 response (`:644-668`, surfaced at
  `src/app/api/leads/route.ts:123`). It is **advisory only — the lead is still created.**
- `createCustomer` hard-blocks: throws `ServiceError(..., "CONFLICT")` on `phoneNorm` match
  (`src/services/clients.ts:385-392`); `updateCustomer` mirrors it (`:470-478`).

Where this breaks:

1. **`Customer.phoneNorm` is nullable and not backfilled by the conversion paths.**
   `convert/route.ts:70-80` and `close-won/route.ts:69-78` call `prisma.customer.create`
   directly with no `phoneNorm`. Customers created by converting a lead therefore have
   `phoneNorm = null` and are invisible to every duplicate check above.
2. **`Lead.phone` is never normalized on write**, so the match depends entirely on
   `leadPhoneToNorm` succeeding at read time. It returns `null` for anything that is not
   `972`-prefixed ≥11 digits or `0`-prefixed ≥9 digits (`:544-547`) — international,
   extension-suffixed, or typo'd numbers silently drop out of dedupe.
3. **The lead-to-lead scan is unindexed and unbounded**: `createLead` loads *every* lead in
   the business with a non-null phone and normalizes them in JS (`:654-663`).
4. **Search is `contains` on the raw string**, not on a normalized column —
   `src/app/api/search/route.ts:33,112` and `src/services/clients.ts` list filter
   (`{ phone: { contains: search } }`). Searching `0501234567` will not find a lead stored
   as `050-123-4567`.

PayCall matching is exact-string on its own format: `prisma.lead.findFirst({ where: {
businessId, phone } })` where `phone` is `0NNNNNNNNN` (`src/lib/paycall.ts:149-156`) —
it will not match a lead whose phone was stored dashed or with `+972`.

There is **no dedupe/merge job, no unique constraint on phone for `Lead`, and no
`Lead.phoneNorm` column.**

---

## 3. API Surface

### 3.1 Lead routes

All under `src/app/api/leads/**` plus `src/app/api/webhooks/lead/**`. All non-webhook
routes call `requireBusinessAuth(request)` + `isGuardError` and derive `businessId` from
the session — never from the body.

| Path | Method | Auth | Request | Response |
|---|---|---|---|---|
| `/api/leads` | GET | session (`route.ts:15-16`) | — | `Lead[]` each with `customer`, `callLogs`, `existingCustomer`, `duplicateLead` (`services/clients.ts:553-596`) |
| `/api/leads` | POST | session + IP rate limit `API_WRITE` (`route.ts:28-32`) | `{name*, phone, email, city, address, requestedService, source, stage, notes, customerId}` (`:38`) | `201 {…lead, existingCustomer, duplicateLead}`; `409` on `CONFLICT`, `404` `NOT_FOUND`, `400` else (`:50-53`) |
| `/api/leads/[id]` | PATCH | session | Zod `PatchLeadSchema` — 18 optional fields incl. `stage`, `nextFollowUpAt`, `followUpStatus`, `lostReasonCode` (`[id]/route.ts:12-30`) | updated `Lead` with `customer`+`callLogs`; `400` on Zod fail (`:42-44`) |
| `/api/leads/[id]` | DELETE | session + RBAC | header `x-confirm-action: DELETE_LEAD_<id>` for owner (`:119-122`) | `403` staff/volunteer (`:97-103`); `202 {pendingApproval, approvalId}` for manager (`:105-117`); `428` if confirm header missing; `{success:true}` |
| `/api/leads/[id]/convert` | POST | session | — | `{customer, lead, alreadyConverted}` (`convert/route.ts:105-109`) |
| `/api/leads/[id]/close-won` | POST | session | — | `{lead, customerId}`; `400` if already won (`close-won/route.ts:44-49`) |
| `/api/leads/[id]/close-lost` | POST | session | `{reasonCode*, reasonText}` validated against `LOST_REASON_CODES` (`close-lost/route.ts:20-33`) | updated lead; `400` if already lost |
| `/api/leads/[id]/call-logs` | GET · POST | session | POST `{summary*, treatment*}`, summary ≤5000 (`call-logs/route.ts:48-62`) | `CallLog[]` / created `CallLog` |
| `/api/leads/[id]/logs` | GET · POST | session | POST `{summary*, treatment, type?}`, type ∈ `["call","stage_change"]` (`logs/route.ts:49-57`) | `CallLog[]` / created `CallLog` |
| `/api/leads/[id]/call-logs/[logId]` | — | session | — | (per-log operations) |
| `/api/leads/calendar` | GET | session | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (both required, `400` otherwise) | `{leads:[{id,name,phone,nextFollowUpAt,requestedService}]}` — filtered to `followUpStatus: "pending"` (`calendar/route.ts:22-40`) |
| `/api/leads/export` | GET | session + per-business rate limit 5/min (`export/route.ts:7,17-20`) | `?from&to` on `createdAt` | UTF-8 CSV with BOM, `take: 10000` (`:52`) |
| `/api/leads/stages` | GET · POST | session | POST `{name*, color?}` — hex-validated (`stages/route.ts:51-56`) | `LeadStage[]`; GET calls `ensureDefaultStages` first (`:12`) |
| `/api/leads/stages/[id]` | — | session | — | stage update/delete |
| `/api/leads/stages/reorder` | — | session | — | sortOrder update |
| `/api/webhooks/lead` | POST | **API key** — see §3.3 | `{name\|fullName\|firstName+lastName, phone, email, source, notes, petName, petBreed\|breed, city, service}` (`webhooks/lead/route.ts:12-27`) | `201 {success, leadId, name, stage}` |
| `/api/webhooks/lead/key` | GET · POST | session + **owner role only** (`key/route.ts:17-27`) | — | `{key}` / regenerated `pk_…` |

`/api/leads/calendar` is the closest thing to a "leads due for follow-up" query endpoint.
It requires both `from` and `to` and returns only `followUpStatus === "pending"`.

### 3.2 Service layer

**Yes — a real service layer exists, and it does not use Supabase client libraries.**

`src/services/` holds 11 domain modules: `appointments.ts`, `boarding.ts`, `business.ts`,
`clients.ts`, `notifications.ts`, `orders.ts`, `pets.ts`, `service-dogs.ts`, `supabase.ts`,
`training.ts`, `types.ts`.

Data access is **Prisma against PostgreSQL** (Supabase-hosted), typed as
`DbClient = PrismaClient` (`src/services/clients.ts:22`). Errors surface as
`ServiceError(message, code)` with codes `NOT_FOUND | UNAUTHORIZED | VALIDATION | CONFLICT
| EXTERNAL` (`src/services/types.ts`, re-exported at `clients.ts:23`).

Adoption for leads is **partial**:

- Through the service layer: `GET /api/leads` → `listLeads`; `POST /api/leads` →
  `createLead`; `PATCH /api/leads/[id]` → `updateLead`; `DELETE` → `deleteLead`
  (`src/app/api/leads/route.ts:11,18,46`, `[id]/route.ts:10,48,126`)
- **Bypassing it, querying Prisma directly in the route**: `convert`, `close-won`,
  `close-lost`, `call-logs`, `logs`, `calendar`, `export`, `stages`, and the lead webhook.

So there is no single chokepoint for lead writes.

The service layer is shared by both HTTP routes and MCP tools —
`src/app/api/mcp/route.ts:20-23` imports `listCustomers, addCustomerNote, createCustomer,
listLeads, createLead` from `@/services/clients`.

### 3.3 Machine-to-machine auth

**Four distinct M2M mechanisms exist.** Not everything is session-bound.

**a) Per-business webhook API key** — `Business.webhookApiKey String? @unique` +
`webhookApiKeyCreatedAt` (`prisma/schema.prisma:245-246`).
Header `x-api-key: pk_<48 hex>`; `businessId` resolved by unique lookup
(`src/app/api/webhooks/lead/route.ts:66-82`). Keys **expire after 90 days**
(`:75-80`). Generated by `randomBytes(24)` (`webhooks/lead/key/route.ts:13-15`),
owner-only to view or regenerate (`:17-27`). This is a lead-scoped key only — it grants
`POST /api/webhooks/lead` and nothing else.

**b) MCP bearer tokens** — `McpConnection` (`prisma/schema.prisma:2301-2321`) with
`businessId`, `tokenHash`, `scopes`, `lastUsedAt`, `revokedAt`; audit rows in
`McpAuditLog` (`:2322-…`).
SHA-256 hash comparison — `hashToken` (`src/lib/mcp-auth.ts:18-20`), `validateMcpToken`
(`:32`), `extractBearerToken` (`:82-85`). `businessId` comes exclusively from the token
(`src/app/api/mcp/route.ts:9-10`). Six tools registered: `list_clients`,
`list_upcoming_appointments`, `get_business_stats`, `create_appointment`,
`add_client_note`, `send_reminder` (`src/app/api/mcp/route.ts:49-258`) — plus the route
imports `listLeads` and `createLead` (`:20`). Rate-limited via `rateLimitAsync`
(Upstash Redis). Kill switch: `MCP_ENABLED`.
`/api/mcp` is an **exact-match** public path in middleware, deliberately not a prefix
(`src/middleware.ts:43`); a path-token form `/api/mcp/u/petra_mcp_<64 hex>` is also allowed
(`:76-78`).

**c) `CRON_SECRET`** — `verifyCronAuth` accepts either `Authorization: Bearer <secret>` or
`x-cron-secret: <secret>`, compared with `crypto.timingSafeEqual` after a length check
(`src/lib/cron-auth.ts:10-34`). Returns `false` when the env var is unset (`:12`).

**d) Legacy `MAKE_WEBHOOK_SECRET` + `WEBHOOK_BUSINESS_ID`** — for non-`pk_` keys, the
webhook does a padded `timingSafeEqual` (`webhooks/lead/route.ts:84-99`) and takes
`businessId` **only** from the env var, explicitly never from the body
(`:100-107`).

There is **no Supabase service-role key or `@supabase/supabase-js` client in the request
path** — Prisma connects with the DB URL, and the RLS note in `prisma/enable_rls.sql:9-11`
states Prisma uses a service_role connection that bypasses RLS.

### 3.4 Webhook endpoints and how authenticity is verified

Six route files under `src/app/api/webhooks/`. Middleware makes the whole
`/api/webhooks/` prefix public — auth is per-route (`src/middleware.ts:14`).

| Endpoint | Verification | File:line |
|---|---|---|
| `/api/webhooks/lead` | `x-api-key` `pk_` unique lookup + 90-day expiry; else padded `timingSafeEqual` vs `MAKE_WEBHOOK_SECRET`. IP rate limit `WEBHOOK_LEAD` before auth | `webhooks/lead/route.ts:41-112` |
| `/api/webhooks/stripe` | `stripe-signature` header; `businessId` parsed from raw JSON **only** to select the per-business webhook secret, then `constructStripeEvent(rawBody, signature, webhookSecret)`; uniform error responses to avoid an oracle | `webhooks/stripe/route.ts:12-46,78-81` |
| `/api/webhooks/invoices` | `x-webhook-signature`; tries `verifyMorningWebhookSignature` against each business's decrypted secret to identify the tenant; rejects if no secret configured; logs only after the signature verifies | `webhooks/invoices/route.ts:29-107` |
| `/api/webhooks/paycall` | **query-string secret** `?secret=<PAYCALL_WEBHOOK_SECRET>` | `webhooks/paycall/route.ts:11,20-25` |
| `/api/webhooks/lead/key` | session + owner role (management endpoint, not an inbound webhook) | `webhooks/lead/key/route.ts:17-27` |
| `/api/webhooks` (generic) | `requireAuth` (session) — dispatches on `x-webhook-source`; all branches are **stubs that only echo `{received:true}`**, no handler implemented | `webhooks/route.ts:7-33` |

The PayCall webhook carries its shared secret in the URL query string, where it lands in
access logs and proxy logs.

---

## 4. Google Calendar

### 4.1 What exists

A full, hand-rolled Google Calendar integration. **No `googleapis` SDK** — `package.json`
has no `googleapis` or `google-auth-library` dependency; the code calls the REST API with
`fetch`.

- Core: `src/lib/google-calendar.ts` (~1210 lines), endpoints hard-coded at `:16-20`
  (`oauth2.googleapis.com/token`, `www.googleapis.com/calendar/v3`, `tokeninfo`)
- Separate login OAuth: `src/lib/google-oauth.ts:30-74`
- Contacts (People API): `src/lib/google-contacts.ts`

**Auth flow**: authorization-code OAuth. `buildCalendarAuthUrl(state)`
(`google-calendar.ts:1209`) → `exchangeCalendarCode(code)` (`:35-82`) using
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GCAL_REDIRECT_URI`; refresh via
`refreshAccessToken(userId)` (`:84`) and `getValidAccessToken(userId)` (`:145`).

**Whose calendar**: **per staff user**, not per business. Tokens live on `PlatformUser` —
`gcalConnected`, `gcalAccessToken`, `gcalRefreshToken`, `gcalTokenExpiresAt`,
`gcalCalendarId`, `gcalCalendarName` (default `"Petra Bookings"`), `gcalConnectedEmail`,
`gcalLastConnectedAt`, `gcalSyncEnabled`, `gcalSelectedCalendars`
(`prisma/schema.prisma:33-45`). Access and refresh tokens are AES-256-GCM encrypted with
`GCAL_ENCRYPTION_KEY` (`google-calendar.ts:5, 10-12`).
`findConnectedUsersForBusiness` (`:556`) and `findConnectedOwnerForBusiness` (`:585`) fan
out to every connected member.

**Read and write.** Write: `createCalendarEvent` (`:352`), `updateCalendarEvent` (`:386`),
`deleteCalendarEvent` (`:442`), `ensureUserCalendar` (`:158`). Read:
`getGcalBusyIntervals` (`:596`) for availability, plus
`GET /api/integrations/google/external-events` and `/list-calendars`.

Entity sync functions: appointments (`:869`, `:890`, `:919`), training-program sessions
(`:1021`, `:1068`), training-group sessions (`:1081`, `:1117`), boarding (`:1136`, `:1195`).
`GcalEntityType` at `:788`.

### 4.2 Source of truth

**Petra's own tables are the source of truth; Google Calendar is a write-mostly mirror.**

Appointments, bookings, boarding stays, and training sessions all live in Postgres
(`Appointment` `prisma/schema.prisma:465-495`, `Booking` `:1086-1123`, etc.). Google holds
a derived copy.

Mapping is stored two ways, which do not agree:

- `GcalEventLink` (`prisma/schema.prisma:1169-1186`) — the correct per-user mapping:
  `@@unique([entityType, entityId, userId])` with `calendarId` + `eventId`. The schema
  comment at `:1165-1168` states explicitly that a single shared `gcalEventId` column
  cannot address more than one user's copy.
- Legacy single-column fields that still exist: `Appointment.gcalEventId` (`:478`) and
  `Booking.gcalEventId / gcalCalendarId / gcalSyncStatus / gcalLastSyncedAt / gcalSyncError`
  (`:1106-1110`).

Sync direction is **Petra → Google**, queued through `SyncJob`
(`prisma/schema.prisma:1142-1167`: `action` `"create"|"update"|"delete"`, `status`
`"queued"|"processing"|"done"|"failed"`, `attempts`, `nextRunAt`, `lastError`) drained by
`GET /api/integrations/google/process-jobs`.

There is **no inbound sync**: no `watch` channel registration, no push-notification
endpoint, no incremental `syncToken` polling anywhere in `src/`. Google-side edits are read
only transiently for busy-time checks (`getGcalBusyIntervals`), never written back into
Petra tables. Recreation on the Petra side happens only on Google 404/410.

### 4.3 Lead phone → does an appointment exist for that person?

**No direct path exists.** There is no query, endpoint, or helper that takes a phone number
and returns appointments. It can only be done as a multi-step join, and it is lossy.

The full chain, as the code stands:

1. `Lead.phone` (raw) → `leadPhoneToNorm(raw)` — `src/services/clients.ts:541-551` →
   `9725XXXXXXXX` or `null`.
2. `Customer.findMany({ where: { businessId, phoneNorm: { in: allNorms } } })` —
   `src/services/clients.ts:571-574`. Result is surfaced on the leads list response as
   `existingCustomer: { id, name }` (`:589-595`), reachable via `GET /api/leads`.
3. `existingCustomer.id` → `getCustomer(businessId, db, customerId)` —
   `src/services/clients.ts:274-…`, which includes `appointments` (id, date, startTime,
   endTime, status, service, pet), `orderBy: { date: "desc" }, take: 100`. Exposed at
   `GET /api/customers/[id]`.

Blocking limitations on that chain:

- `listAppointments` supports **only `from`/`to`** — `AppointmentListOptions` is
  `{ from?, to? }` (`src/services/appointments.ts:21-24`), and `GET /api/appointments`
  passes only those two (`src/app/api/appointments/route.ts:23-26`). **There is no
  `customerId` or `phone` filter on the appointments endpoint.** The only customer-scoped
  read is the whole-customer include in step 3.
- Step 2 fails whenever `Customer.phoneNorm` is `null` — which is exactly the case for
  customers created by `convert` / `close-won` (§1.5, §2.3).
- Step 1 fails for any phone shape `leadPhoneToNorm` does not recognise.
- Nothing here consults Google Calendar. `getGcalBusyIntervals` (`:596`) returns
  time intervals for slot computation; it has no attendee, phone, or identity dimension.
- Appointments booked under a *different* customer record (duplicate person) are invisible.

---

## 5. Users and Permissions

### 5.1 Roles

Two independent axes — `src/lib/permissions.ts:10-27`.

**Platform roles** — `PlatformUser.platformRole String?` (`prisma/schema.prisma:26`):
`super_admin`, `admin`, `support`, or `null` (`permissions.ts:13-17`).

**Tenant roles** — `BusinessUser.role String @default("user")` (`prisma/schema.prisma:96`):
`owner`, `manager`, `user`, `volunteer` (`permissions.ts:21-26`).

Note the schema comment on `BusinessUser.role` lists only `"owner" | "manager" | "user"`
(`:96`) while `TENANT_ROLES` also defines `volunteer`, which lead DELETE checks for
explicitly (`src/app/api/leads/[id]/route.ts:100`).

There is also a **legacy** `PlatformUser.role String @default("USER")` holding
`"USER" | "MASTER"` (`prisma/schema.prisma:25`), separate from `platformRole`.

**Is there a sales-manager role distinct from owner? Not found.** The permission matrix
(`src/lib/permissions.ts:82-99`) has no sales, leads, or pipeline dimension. `manager` is a
general second tier: it holds `content.write`, `analytics.read`, `settings.write`,
`users.read`, `audit.read`, `finance.read`, `customers.pii` — but not `finance.summary`,
`critical.delete`, `settings.critical`, `users.write`, or `approve.actions`. There is **no
`TENANT_PERMS` entry scoped to leads**; lead access rides on the generic
`CONTENT_READ`/`CONTENT_WRITE`.

Effective lead permissions today:

- Read (`GET /api/leads`) and write (`POST`, `PATCH`): any authenticated member with an
  active membership. `requireBusinessAuth` performs **no role check at all** —
  `src/lib/auth-guards.ts:220-292`.
- Delete: role-gated at `src/app/api/leads/[id]/route.ts:94-122` — `user` and `volunteer`
  → `403`; `manager` → `202` with a `PendingApproval` row (`:105-117`); `owner` → requires
  `x-confirm-action: DELETE_LEAD_<id>` else `428`.
- Webhook key management: `owner` only (`webhooks/lead/key/route.ts:17-27`).

`requireBusinessAuth` resolves a single business by preferring an `owner` membership,
falling back to the first active one (`auth-guards.ts:250-253`) — there is no
`?businessId=` selector for multi-business users on lead routes.

### 5.2 RLS on the leads tables

**RLS is enabled with zero policies — a deny-all posture for PostgREST, bypassed entirely
by the app.**

`prisma/enable_rls.sql` is a flat list of `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
statements, including `"public"."Lead"` (`:30`), `"public"."LeadStage"` (`:31`), and
`"public"."CallLog"` (`:27`). The file contains **zero `CREATE POLICY` statements** —
confirmed by `grep -c "CREATE POLICY"` returning `0`.

The file's own header states the intent (`:6-11`): Supabase exposes public tables via
PostgREST, so RLS with no permissive policies blocks the `anon`/`authenticated` roles,
while Prisma connects with `service_role`, which bypasses RLS by design. The footer repeats
it: no policies needed.

Consequences: **all tenant isolation for leads is application-level**, enforced by
`requireBusinessAuth` deriving `businessId` from the session and every query carrying
`where: { businessId }` (e.g. `services/clients.ts:555`, `733`, `823`;
`leads/[id]/convert/route.ts:28`). There is no database-level backstop. The file is a
manual runbook — it is not a migration and is not applied by any tooling in the repo.

### 5.3 Per-user assignment on a lead

**Not found.** `Lead` (`prisma/schema.prisma:594-631`) has no `assignedToUserId`,
`ownerId`, `salesRepId`, or equivalent. The only user-referencing columns are
`wonByUserId` and `lostByUserId` (`:606`, `:609`) — both plain `String?` with **no FK
relation** and, as noted in §1.2, **never written by any code in `src/`**.

`CallLog` also has no author column (`:650-662`), so touchpoints are not attributable.

Indirect, partial attribution exists via the auto-created follow-up `Task`
(`src/services/clients.ts:800-812`) — `Task` has `assignedTo` and is linked back through
`relatedEntityType: "LEAD"` / `relatedEntityId` (`prisma/schema.prisma:731-765`). The
task created by `updateLead` does **not** set `assignedTo` (`clients.ts:802-810`).

---

## 6. Messaging and Notifications

### 6.1 Outbound messaging

**WhatsApp — Meta Cloud API (primary).** `src/lib/whatsapp.ts`.
Credentials `META_WHATSAPP_TOKEN` + `META_PHONE_NUMBER_ID` read at `:60-61` and `:110-111`.
Exports `sendWhatsAppMessage` (`:215`), `sendWhatsAppTemplate` (`:236`),
`interpolateTemplate` (`:251`).

**WhatsApp — Twilio (fallback path in the same file).** `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (default `whatsapp:+14155238886`) —
`src/lib/whatsapp.ts:171-191`.

**Email — Resend.** `src/lib/email.ts`, `RESEND_API_KEY` + `EMAIL_FROM`
(`src/lib/notify-owner.ts:93,107`). Senders: `sendEmail` (`email.ts:202`),
`sendWelcomeEmail` (`:221`), `sendPasswordResetEmail` (`:245`),
`sendTeamInvitationEmail` (`:350`), `sendSupportTicketEmail` (`:434`),
`sendCheckoutWelcomeEmail` (`:63`), `sendUpgradeConfirmationEmail` (`:146`).

**SMS** — `ScheduledMessage.channel` accepts `"sms"` (`prisma/schema.prisma:1461`), but no
SMS provider integration exists in `src/lib/`. **Not found.**

**Push** — **not found.**

Lead-specific invocations that already exist:

- New-lead alert to the business owner, gated on the `lead_notifications` feature flag
  (PRO+): template `petra_biz_lead_alert` with 5 body params, falling back to a free-form
  message on failure. Two copies of the same logic —
  `src/app/api/leads/route.ts:60-104` and `src/app/api/webhooks/lead/route.ts:167-209`.
  Both `await Promise.allSettled(...)`, and both fan out to `business.phone` plus any
  `featureOverrides.lead_notification_phones`.
- `MessageTemplate` (`prisma/schema.prisma:700-714`) + `AutomationRule` (`:716-729`).
  `VALID_AUTOMATION_TRIGGERS` (`src/lib/automation-triggers.ts:15-27`) includes
  **`lead_followup`** as a canonical trigger key. Grepping `src/lib/reminder-service.ts`
  and `src/lib/scheduled-messages.ts` shows scheduling functions for appointment,
  boarding, group-session, training-session, and service-dog-meeting reminders — **there is
  no scheduler function that consumes `lead_followup`.** The trigger key is declared and
  selectable but nothing dispatches on it.

### 6.2 Job scheduling and deferred work

**Three mechanisms.**

**a) Vercel Cron** — `vercel.json:12-55`, 11 daily entries:
`/api/cron/send-reminders` 09:00, `/api/integrations/google/process-jobs` 07:00,
`/api/cron/generate-tasks` 05:00, `/api/cron/birthday-reminders` 04:00,
`/api/cron/vaccination-reminders` 03:00, `/api/cron/service-dog-alerts` 08:00,
`/api/cron/service-dog-meeting-reminders` 02:00, `/api/invoicing/process-jobs` 09:00,
`/api/cron/expire-subscriptions` 01:00, `/api/cron/paycall-sync` 06:00,
`/api/cron/charge-trials` 06:00. All UTC, all once-daily.

**b) GitHub Actions cron** — `.github/workflows/cron.yml`, the higher-frequency driver:
every 15 min → `/api/cron/send-reminders`; every 5 min → `/api/integrations/google/process-jobs`;
every 10 min → `/api/invoicing/process-jobs`. Each step `curl`s
`https://petra-app.com/...` with `Authorization: Bearer ${{ secrets.CRON_SECRET }}` and
`--max-time 30`.

Guarantees: **at-least-once, best-effort, no retry on failure.** Both drivers are
fire-and-forget HTTP calls; a non-2xx or a timeout is not retried. GitHub Actions schedules
are themselves best-effort and can be delayed or dropped under load. `--max-time 30` caps
each invocation.

**c) DB-backed queues** — two, both drained by the crons above:

- `ScheduledMessage` (`prisma/schema.prisma:1457-1481`): `channel`, `templateKey`,
  `payloadJson`, `sendAt`, `status` (`PENDING|SENT|FAILED|CANCELED`), `relatedEntityType`,
  `relatedEntityId`. Index `[businessId, status, sendAt]`. Drained by
  `processPendingReminders()` (`src/lib/scheduled-messages.ts:109`) from
  `/api/cron/send-reminders` (`src/app/api/cron/send-reminders/route.ts:13`).
  **No attempt counter, no backoff, no dead-letter** — a row goes `PENDING → SENT|FAILED`.
- `SyncJob` (`prisma/schema.prisma:1142-1167`): the only queue with retry semantics —
  `attempts Int`, `nextRunAt DateTime`, `lastError String?`, index `[status, nextRunAt]`.
  Bound to `Booking` by FK, so it cannot carry non-booking work.

Scheduling helpers on top of `ScheduledMessage`: `src/lib/reminder-service.ts` —
`scheduleAppointmentReminder` (`:47`), `scheduleAppointmentFollowup` (`:144`),
`cancelAppointmentReminders` (`:215`), `rescheduleAppointmentReminder` (`:230`),
`scheduleBoardingCheckoutReminder` (`:255`), `scheduleBoardingThankYou` (`:359`),
`scheduleGroupSessionReminders` (`:428`), `scheduleServiceDogMeetingReminder` (`:714`),
`scheduleTrainingSessionReminder` (`:788`). **No lead-related scheduling function exists.**

There is **no external queue** — no BullMQ, no Inngest, no QStash, no Temporal.

### 6.3 Reaching a staff member

- **In-app notification** — `Notification` (`prisma/schema.prisma:997-1011`): `userId`
  (FK `PlatformUser`, cascade), `title`, `message`, `isRead`, `actionUrl`, `createdAt`.
  Indexes `[userId, isRead]`, `[userId, createdAt]`. Routes:
  `src/app/api/user-notifications/route.ts`, `.../read-all/route.ts`, `.../[id]/route.ts`,
  and `src/app/api/notifications/route.ts`. This is the only per-staff-user in-app channel.
- **WhatsApp to the business owner** — `src/lib/notify-owner.ts`:
  `notifyOwnerWhatsAppDown` (`:131`), `notifyOwnerNewUser` (`:195`). Sends to
  `business.phone` / a hard-coded platform owner number, plus Resend email.
- **`SystemMessage`** (`prisma/schema.prisma:977-995`) — platform-to-tenant broadcast.
- **Email** — any address, via `sendEmail` (`src/lib/email.ts:202`).

Notification delivery is direct, not queued: nothing writes `Notification` rows off a
schedule, and `ScheduledMessage.customerId` (`prisma/schema.prisma:1460`) points at
`Customer`, not at a staff `PlatformUser` — the deferred-send queue cannot address staff.

---

## 7. Conventions

### 7.1 Migration tooling

**`prisma db push` — there is no migration history.**

`package.json` scripts: `"db:push": "prisma db push"`, `"db:generate": "prisma generate"`.
There is **no `prisma migrate` script**, and **`prisma/migrations/` does not exist**
(the directory listing of `prisma/` shows only `dev.db`, `enable_rls.sql`,
`gcal_event_link.sql`, `schema.prisma`, `schema.production.prisma`, and three seed scripts).

Two schema files are maintained in parallel:
- `prisma/schema.prisma` — local/dev
- `prisma/schema.production.prisma` — used by Vercel:
  `"vercel-build": "prisma generate --schema=prisma/schema.production.prisma && node scripts/audit-route-auth.mjs && next build"`.
  `CLAUDE.md` rule 4 requires copying the former over the latter after every schema change.

Neither `build` nor `vercel-build` applies DDL — `prisma generate` only emits the client.
**Schema changes reach production by manually running `db:push` or by hand-executing SQL.**

Loose SQL, applied by hand, not tracked by any tool:
- `prisma/enable_rls.sql` — header says "Run this once in the Supabase SQL Editor" (`:2-4`)
- `prisma/gcal_event_link.sql`
- `supabase/migrations/20260319_add_performance_indexes.sql` — the only file in that
  directory; there is no Supabase CLI config or migration runner in the repo.

`build` and `vercel-build` both run `scripts/audit-route-auth.mjs` as a gate
(`npm run audit:routes`).

### 7.2 Environment variables

Names only. Typed accessors in `src/lib/env.ts:40-108` (server-only — the module throws at
load if `window` is defined, `:14-19`; `DATABASE_URL`/`DIRECT_URL` are lazy getters,
`:56-61`, for the reason documented at `:48-55`).

Declared in `env.ts`: `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`, `APP_URL`,
`NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
`GCAL_REDIRECT_URI`, `GCAL_ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`INVOICING_ENCRYPTION_KEY`, `STRIPE_ENCRYPTION_KEY`, `MAKE_WEBHOOK_SECRET`,
`WEBHOOK_BUSINESS_ID`, `BLOB_READ_WRITE_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_WHATSAPP_FROM`.

Read directly via `process.env` in `src/` but **absent from `env.ts`**:
`CARDCOM_API_USERNAME`, `CARDCOM_TERMINAL_NUMBER`, `CARDCOM_WEBHOOK_SECRET`,
`ENABLE_DEBUG_ENDPOINTS`, `MCP_ENABLED`, `META_PHONE_NUMBER_ID`, `META_WHATSAPP_TOKEN`,
`NEXT_RUNTIME`, `PAYCALL_BUSINESS_ID`, `PAYCALL_NEW_LEAD_STAGE_ID`, `PAYCALL_PASSWORD`,
`PAYCALL_USERNAME`, `PAYCALL_USER_ID`, `PAYCALL_WEBHOOK_SECRET`,
`UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL`.

Conventions observed: `SCREAMING_SNAKE_CASE` throughout; `NEXT_PUBLIC_` prefix for the
browser-exposed value; `<VENDOR>_<THING>` grouping (`GOOGLE_`, `GCAL_`, `META_`,
`TWILIO_`, `CARDCOM_`, `PAYCALL_`, `UPSTASH_REDIS_`); `_SECRET` for shared secrets,
`_ENCRYPTION_KEY` for at-rest keys, `_TOKEN` for bearer credentials.

`isDev` / `isStaging` / `isProd` derived at `env.ts:115-124` — `isStaging` keys off
`APP_URL.includes("staging")`.

### 7.3 Testing

**Configured but not installed — tests cannot currently be run.**

`jest.config.js` exists (`preset: "ts-jest"`, `testEnvironment: "node"`,
`moduleNameMapper` `^@/(.*)$ → <rootDir>/src/$1`, `testMatch` `**/*.test.ts(x)`).

However:
- `package.json` has **no `test` script** (scripts are `dev`, `audit:routes`, `build`,
  `vercel-build`, `postinstall`, `start`, `lint`, `db:push`, `db:generate`, `db:seed`,
  `db:seed-admin`, `deploy:staging`, `deploy:production`).
- `package.json` `devDependencies` contains **no `jest`, `ts-jest`, `@types/jest`,
  `vitest`, `playwright`, `cypress`, or `@testing-library/*`** — the list is
  `@types/bcryptjs`, `@types/node`, `@types/qrcode`, `@types/react`, `@types/react-dom`,
  `autoprefixer`, `eslint`, `eslint-config-next`, `postcss`, `prisma`, `tailwindcss`,
  `tailwindcss-animate`, `ts-node`, `typescript`.
- `node_modules/.bin/` contains no `jest` or `ts-jest` binary.

Test files present (8, first-party):
`src/__tests__/intake.test.ts`, `src/__tests__/onboarding-progress.test.ts`,
`src/__tests__/onboarding-analytics.test.ts`, `src/lib/booking-engine.test.ts`,
`src/lib/order-calc.test.ts`, `src/lib/permissions.test.ts`, `src/lib/slots.test.ts`,
`src/lib/__tests__/reminder-service.test.ts`.

Coverage of the lead path: **zero.** No test touches `Lead`, `LeadStage`, `CallLog`,
`services/clients.ts` leads section, or any `/api/leads` route.

The actual CI gates are the build-time checks: `scripts/audit-route-auth.mjs` (route auth
audit) and `next build` / `tsc`, both wired into `build` and `vercel-build`.

### 7.4 Timezone handling

**Storage: UTC.** Prisma `DateTime` maps to `timestamp(3)` and is handled as UTC by the
client. `Booking.startAt` / `endAt` are commented `// UTC`
(`prisma/schema.prisma:1092-1093`).

**Conversion: `Asia/Jerusalem`, applied ad hoc at ~30 call sites**, always via
`Intl.DateTimeFormat` / `toLocaleString` with an explicit `timeZone` option. There is **no
central date/time module** — `src/lib/` has no `date.ts`, `time.ts`, or `tz.ts`, and no
`date-fns-tz`, `luxon`, `dayjs`, or `temporal` dependency.

Where conversion lives:

- `src/lib/google-calendar.ts` — `BOOKING_TIMEZONE = "Asia/Jerusalem"` (`:20`);
  a helper returning the UTC offset string (`+02:00`/`+03:00`) for a given date
  (`:672-680`) so DST is handled per-instant; formatting at `:700`, `:942`, `:945`
- `src/lib/reminder-service.ts` — `israelDateTime(date, timeHHmm)` (`:26`), offset helper
  (`:8-11`), plus explicit `timeZone: "Asia/Jerusalem"` at `:88, 176, 287, 628, 634, 737,
  739, 814, 819`
- `src/lib/slots.ts:40` — treats a wall-clock time as being in a given IANA zone;
  `localTimeToUtc` used by `src/app/api/appointments/route.ts:12`
- `src/lib/paycall.ts:149` — **hard-codes `+03:00`**:
  `new Date(call.START.replace(" ", "T") + "+03:00")`. This is Israel Daylight Time; during
  standard time (roughly late Oct – late Mar) it is off by one hour.
- `src/lib/login-alerts.ts:122`, `src/lib/notify-owner.ts:182`, and several `/api/owner/*`
  PDF/CSV routes — display formatting only

**Per-business timezone exists but is barely used**: `Business.timezone String @default(
"Asia/Jerusalem")` (`prisma/schema.prisma:244`). Only `src/app/api/appointments/route.ts:174`
reads it (`business?.timezone || "Asia/Jerusalem"`); everywhere else the string is
hard-coded.

Lead-specific date handling ignores timezone entirely — the follow-up calendar and export
routes parse bare date strings as **server-local**:
`new Date(from + "T00:00:00")` / `new Date(to + "T23:59:59")` with no offset —
`src/app/api/leads/calendar/route.ts:26-27` and `src/app/api/leads/export/route.ts:28,31,38-39`.
`updateLead` stores `nextFollowUpAt` as `new Date(input.nextFollowUpAt)` from an
ISO-8601 string (`src/services/clients.ts:788`), and the Zod schema requires
`.datetime()` (`src/app/api/leads/[id]/route.ts:27`), so the stored instant is correct —
but the calendar range query that reads it is not timezone-aware.

---

## (a) Capabilities that already exist and are reusable as-is

1. **Lead CRUD through a service layer with tenant isolation** — `listLeads`, `createLead`,
   `updateLead`, `deleteLead` (`src/services/clients.ts:553-841`), all `businessId`-scoped,
   already shared between HTTP routes and MCP tools.
2. **Per-business, per-stage pipeline model** with `isWon`/`isLost` flags and idempotent
   seeding — `LeadStage` (`prisma/schema.prisma:634-648`), `ensureDefaultStages` /
   `getFirstLeadStageId` (`src/lib/lead-stages.ts:20-81`).
3. **Follow-up scheduling fields already on the row** — `nextFollowUpAt`, `followUpStatus`,
   `followUpTaskId` (`prisma/schema.prisma:616-618`), with automatic `Task` create/delete
   sync in `updateLead` (`src/services/clients.ts:795-818`).
4. **A due-follow-ups query endpoint** — `GET /api/leads/calendar?from&to`, already filtered
   to `followUpStatus: "pending"` (`src/app/api/leads/calendar/route.ts:22-40`).
5. **A per-lead touchpoint log** — `CallLog` with `type`, `summary`, `treatment`, and a
   `[leadId, createdAt]` index (`prisma/schema.prisma:650-662`), plus GET/POST endpoints.
6. **Terminal-outcome capture** — `wonAt` / `lostAt` auto-stamped on stage flip
   (`src/services/clients.ts:737-747`), and a validated lost-reason vocabulary
   (`src/lib/constants.ts:86-95`).
7. **Machine-to-machine auth, already built and in production** — per-business `pk_` webhook
   keys with 90-day expiry (`src/app/api/webhooks/lead/route.ts:66-82`), SHA-256 MCP bearer
   tokens with per-connection audit rows (`src/lib/mcp-auth.ts`), timing-safe `CRON_SECRET`
   verification (`src/lib/cron-auth.ts:10-34`).
8. **A live inbound-lead ingestion path** — `POST /api/webhooks/lead`, rate-limited,
   key-authenticated, auto-resolving the first pipeline stage
   (`src/app/api/webhooks/lead/route.ts`).
9. **An automated inbound-call → lead path** — PayCall missed-call ingestion with call-id
   idempotency, `lastContactedAt` bump, and `CallLog` append
   (`src/lib/paycall.ts:137-212`), driven by both a webhook and a 24-hour backfill cron.
10. **WhatsApp send infrastructure** — Meta Cloud API templates + free-form with fallback
    (`src/lib/whatsapp.ts:215,236`), already used for lead alerts on both the manual and
    webhook create paths.
11. **A durable deferred-send queue** — `ScheduledMessage` with `sendAt` + status and a
    `[businessId, status, sendAt]` index (`prisma/schema.prisma:1457-1481`), drained every
    ~15 min by `processPendingReminders()` (`src/lib/scheduled-messages.ts:109`).
12. **A cron harness with sub-daily frequency** — `.github/workflows/cron.yml` (5/10/15-min
    schedules) layered over `vercel.json` daily crons.
13. **Duplicate *detection* between leads and customers** — phone-normalized matching that
    already surfaces `existingCustomer` and `duplicateLead` on both the list and create
    responses (`src/services/clients.ts:553-596`, `644-668`).
14. **Tier/feature gating** — `hasFeatureWithOverrides` + per-business `featureOverrides`
    JSON, with `lead_notifications` as a working precedent
    (`src/app/api/leads/route.ts:61-66`).
15. **RBAC primitives** — `TENANT_ROLES` / `TENANT_PERMS` / `hasTenantPermission`, and a
    manager-approval escalation path via `PendingApproval`
    (`src/lib/permissions.ts`, `src/app/api/leads/[id]/route.ts:94-122`).
16. **Structured dog data model** — `DogHealth` (`prisma/schema.prisma:1560-1606`) and
    `DogBehavior` with 13 boolean presenting problems (`:1608-1636`), fed by the tokenized
    `IntakeForm` flow.
17. **Per-user Google Calendar write sync with a correct multi-user mapping table** —
    `GcalEventLink` (`prisma/schema.prisma:1169-1186`), encrypted token storage on
    `PlatformUser`, and a retrying `SyncJob` queue (`:1142-1167`).
18. **In-app per-staff-user notifications** — `Notification` model + four routes under
    `/api/user-notifications`.
19. **Distributed rate limiting** — `rateLimitAsync` on Upstash Redis, already applied to
    lead create, lead export, and MCP.
20. **A build-time route-auth gate** — `scripts/audit-route-auth.mjs`, run by both `build`
    and `vercel-build`.

## (b) Gaps that would need to be built

1. **No stage-transition history.** No audit table, no `stageChangedAt`, no per-transition
   row. Only terminal `wonAt`/`lostAt` on the row (`prisma/schema.prisma:605,608`). "How
   long has this lead sat unanswered in stage X" is not answerable from the data.
2. **Server-side stage changes leave no trace.** The only stage-change record is a
   client-issued, best-effort `CallLog` POST from the Kanban UI
   (`src/app/(dashboard)/leads/page.tsx:1501-1503`); `PATCH /api/leads/[id]` writes nothing.
3. **No "unanswered" signal.** No first-response timestamp, no inbound/outbound direction on
   `CallLog`, no reply tracking. `lastContactedAt` is written by PayCall and manual PATCH
   only (`src/lib/paycall.ts:171-174`, `src/services/clients.ts:783`) — nothing sets it when
   a WhatsApp message is sent.
4. **`Lead.phone` is stored raw and un-normalized** (`src/services/clients.ts:687,775`).
   There is no `Lead.phoneNorm` column and no index on any phone column for `Lead`.
5. **No shared canonical phone helper.** Five normalizers producing three output formats;
   two different functions exported as `normalizeIsraeliPhone`
   (`src/lib/validation.ts:14` vs `src/lib/paycall.ts:123`).
6. **Lead→customer conversion does not set `Customer.phoneNorm`** —
   `src/app/api/leads/[id]/convert/route.ts:70-80` and
   `src/app/api/leads/[id]/close-won/route.ts:69-78` bypass `createCustomer`. Those
   customers are permanently invisible to every duplicate check.
7. **No dedupe or merge.** Duplicates are flagged at read time and never resolved; no unique
   constraint, no merge endpoint, no backfill job.
8. **Duplicate-scan is O(all leads in business), in JS.** `createLead` loads every lead with
   a phone and normalizes in a loop (`src/services/clients.ts:654-663`).
9. **No dog data at the lead stage.** `Lead` has no breed/age/problem columns; the webhook
   flattens `petName`/`petBreed` into `notes` prose
   (`src/app/api/webhooks/lead/route.ts:139-146`). `IntakeForm` has no `leadId`
   (`prisma/schema.prisma:1532-1558`).
10. **No lead assignment.** No assignee/owner column; `wonByUserId`/`lostByUserId` exist but
    are never written by any code. `CallLog` has no author.
11. **No sales role.** No lead-scoped permission in `TENANT_PERMS`; read/write on leads is
    open to every active member because `requireBusinessAuth` performs no role check
    (`src/lib/auth-guards.ts:220-292`).
12. **`lead_followup` is a dead trigger.** Declared in `VALID_AUTOMATION_TRIGGERS`
    (`src/lib/automation-triggers.ts:20`) with no scheduler, no dispatcher, and no
    consumer anywhere in `reminder-service.ts` or `scheduled-messages.ts`.
13. **No lead-targeted messaging.** `ScheduledMessage.customerId` FKs to `Customer`
    (`prisma/schema.prisma:1460`); there is no `leadId`, so a lead with no customer record
    cannot be queued for a send at all.
14. **No delivery or reply tracking.** No WhatsApp delivery webhook — the generic
    `/api/webhooks` handler's `"whatsapp"` branch is a stub returning `{received:true}`
    (`src/app/api/webhooks/route.ts:19-21`). No inbound-message endpoint. No opt-out flag on
    `Lead` or `Customer`.
15. **`ScheduledMessage` has no retry semantics** — no `attempts`, no `nextRunAt`, no
    backoff, no dead-letter (`prisma/schema.prisma:1457-1481`). Only `SyncJob` has them, and
    it is FK-bound to `Booking`.
16. **Cron is at-least-once, best-effort, unretried.** Both drivers are fire-and-forget
    `curl`/HTTP with `--max-time 30` (`.github/workflows/cron.yml`); a failed invocation is
    simply lost.
17. **No path from a phone number to an appointment.** `AppointmentListOptions` is
    `{ from?, to? }` only (`src/services/appointments.ts:21-24`) — no `customerId`, no
    `phone` filter on `GET /api/appointments`. The only route is
    lead.phone → norm → `Customer.phoneNorm` → `getCustomer` include, which breaks whenever
    `phoneNorm` is null (see gap 6).
18. **No inbound Google Calendar sync.** No `watch` channels, no push endpoint, no
    `syncToken` polling. Google-side edits never reach Petra tables. `getGcalBusyIntervals`
    returns time intervals with no identity dimension — a booking made directly in Google
    cannot be attributed to a lead.
19. **Two competing gcal mappings.** `GcalEventLink` (correct, per-user) coexists with
    legacy single-column `Appointment.gcalEventId` / `Booking.gcalEventId`
    (`prisma/schema.prisma:478`, `:1106`).
20. **No RLS policies on any lead table.** RLS is enabled with zero `CREATE POLICY`
    statements (`prisma/enable_rls.sql`, deliberate per its header) — tenant isolation is
    100% application-level, with no database backstop for a new writer.
21. **No migration history.** `prisma/migrations/` does not exist; `db push` plus
    hand-executed SQL. Two schema files must be kept in sync manually, and no build step
    applies DDL.
22. **Tests cannot be run.** `jest.config.js` exists, but jest/ts-jest are absent from
    `devDependencies` and `node_modules/.bin`, and there is no `test` script. Lead-path
    test coverage is zero regardless.
23. **Timezone handling is ad hoc.** No shared date module, no tz library, ~30 hard-coded
    `"Asia/Jerusalem"` sites, `Business.timezone` read at exactly one call site
    (`src/app/api/appointments/route.ts:174`), a hard-coded `+03:00` in
    `src/lib/paycall.ts:149`, and server-local date parsing in the lead calendar and export
    routes (`src/app/api/leads/calendar/route.ts:26-27`).
24. **Duplicated business logic across lead routes.** `convert` and `close-won` are
    near-identical and both bypass the service layer; the new-lead WhatsApp alert block is
    copy-pasted between `src/app/api/leads/route.ts:60-104` and
    `src/app/api/webhooks/lead/route.ts:167-209`; `call-logs/route.ts` and `logs/route.ts`
    have identical GET handlers. Any new lead-lifecycle behavior would need wiring into each
    copy.
25. **Won/lost stage auto-creation is inconsistent.** `lead-stages.ts:44` creates
    `"לקוח"`; `convert/route.ts:54` and `close-won/route.ts:34` create `"נסגר בהצלחה"` —
    a business can end up with two won stages.
26. **PayCall lead matching is exact-string on `0NNNNNNNNN`**
    (`src/lib/paycall.ts:149-156`) — misses any lead whose phone was stored dashed or
    `+972`-prefixed, silently creating a duplicate lead instead.
27. **PayCall is single-tenant.** Hard-wired to `PAYCALL_BUSINESS_ID` and
    `PAYCALL_NEW_LEAD_STAGE_ID` env vars (`src/lib/paycall.ts:142-146`), and its webhook
    secret travels in the URL query string (`src/app/api/webhooks/paycall/route.ts:25`).
28. **No staff-reachable deferred notification.** `Notification` rows are only written
    inline; the `ScheduledMessage` queue cannot address a `PlatformUser`.
29. **No SMS and no push provider** — `ScheduledMessage.channel` accepts `"sms"` but no
    integration exists.
30. **`listLeads` returns everything** — `take: 1000`, no pagination, no stage filter, no
    date filter (`src/services/clients.ts:553-558`).
