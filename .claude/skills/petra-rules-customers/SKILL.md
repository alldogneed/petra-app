---
name: petra-rules-customers
description: "Petra customer invariants moved out of CLAUDE.md (rules 17, 37, 38, 39): customer DELETE runs sequentially with NO $transaction (PgBouncer) in a fixed cleanup order, one balance definition with server-side filters and a shared access rule, the customer card summary contract and section components, merging duplicate customers. Load BEFORE touching /api/customers*, customers pages, the customer card, customer delete/merge, balances or debt figures."
---

# Petra — Customers — rules

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### 17. Customer DELETE — sequential, NO $transaction
Supabase PgBouncer (transaction pooling) is incompatible with Prisma interactive transactions. Customer delete runs all cleanup sequentially:
```
InvoiceDocument.updateMany(originalInvoiceId→null) → InvoiceDocument.deleteMany → InvoiceJob.deleteMany
→ Payment.deleteMany → Appointment.deleteMany → OrderLine.deleteMany → Order.deleteMany
→ BoardingStay.updateMany(customerId→null) → Lead.updateMany(customerId→null)
→ TrainingProgram.updateMany(customerId→null) → Booking.deleteMany
→ ScheduledMessage/ContractRequest/IntakeForm/TimelineEvent/ServiceDogRecipient/TrainingGroupParticipant.deleteMany
→ Task.deleteMany(relatedEntityType="CUSTOMER") → Pet.deleteMany → Customer.delete
```
`Booking.customerId` is non-nullable → must deleteMany, not updateMany(null).
`Task` has no `customerId` FK — uses `relatedEntityType`/`relatedEntityId` strings.
`InvoiceDocument` has self-referencing credit note → must null `originalInvoiceId` before deleteMany.

### 37. Customers — one balance, server-side filters, shared access rule
- **Balance = `src/lib/customer-balance.ts`** (`computeCustomerBalances(db, businessId, ids|null)` / `computeCustomerBalance`) — same definition as `outstanding-balances.ts` (open orders minus paid + pending payments not linked to a counted order). Customers list (`financial.totalPending`), debt filter/balance sort, export columns, customer card `summary.balance` and MCP `get_client` all use it. Never sum `customer.payments` on the client.
- **List = `src/services/customer-list.ts`** (re-exported from `clients.ts`). EVERY filter (status/balance/tag/lastVisit/species/source/created/minDebt/serviceType) and sort runs on the server; `stats` (first page) + `total` drive pills/footer/free-tier banner — never counts of loaded pages. Param allowlists, phone-search normalisation (digits, 972→0, matched on `regexp_replace(phone)` — `phoneNorm` is NULL on old rows), exact-tag LIKE escaping, status rules (active = upcoming appt / visit ≤60d / boarding / active training / created ≤7d; VIP = exact tag, case-insensitive) live in `src/lib/customer-filters.ts` (tests). No FINANCE_READ → balance filter/sort ignored, money zeroed.
- **Access = `src/lib/customer-access.ts`**: `requireCustomerAccess(req, "read")` = CUSTOMERS_PII, `"write"` = + CONTENT_WRITE (overrides honoured, super_admin passes). Used by `/api/customers`, `[id]`, timeline, documents, pets, sales-history, appointments, bulk. Money (`summary.balance`, payments, order amounts) only with FINANCE_READ; `/whatsapp` also needs MESSAGES_SEND; delete/merge = CRITICAL_DELETE. Client flag `usePermissions().canWriteCustomers`.
- Bulk: `POST /api/customers/bulk {action: add_tag|remove_tag, tag, ids≤500}` (ids re-checked against the business, logs `BULK_UPDATE_CUSTOMERS`). Export honours the same filters + `ids`. Bulk WhatsApp = one wa.me per click queue (`{שם}` personalisation) — never `window.open` in a loop.

### 38. Customer card — summary contract + section components
- `GET /api/customers/[id]` adds `summary { balance|null, counts{appointments, upcomingAppointments, pastVisits, payments, orders, timelineEvents, pets}, nextAppointment, lastVisit }` (`src/services/customer-detail.ts`, pure helpers `src/lib/customer-summary.ts`); training programs carry `completedSessions` (no `sessions[]`). Paged sub-resources: `[id]/appointments?scope=upcoming|past`, `[id]/payments` (FINANCE_READ), `[id]/timeline` (+ `PATCH/DELETE [id]/timeline/[eventId]` — notes only). Documents JSON is updated with compare-and-swap (`mutateCustomerDocuments`), never blind read-modify-write.
- UI: `customers/[id]/page.tsx` is a thin shell; sections live in `src/components/customers/detail/*` (CustomerHeader, SummaryStrip, SectionNav, ContactCard w/ inline tags, PetsSection/PetCard, AppointmentsSection, PaymentsSection + RecordPaymentModal → `POST /api/payments`, OrdersSection, TrainingSections, TimelineSection, …). Sub-queries use keys under `["customer", id, …]`; no polling. Gate by `usePermissions()` flags only (canCriticalDelete, canWritePayments, canSendMessages, canSeeFinance, canWriteCustomers). `app-shell` `<main>` is `overflow-x-clip` (not `hidden`) so sticky section chips work.

### 39. Merging duplicate customers
`src/lib/customer-merge-plan.ts` (`MERGE_RELATIONS`) is the single source of truth for every column that references a customer; `src/services/customer-merge.ts` re-points them sequentially (no `$transaction`), merges fields (fill empties, notes concat, tag union, documents concat), re-counts and refuses to delete the source if anything still points at it, then deletes it and writes a timeline note. Routes `GET/POST /api/customers/[id]/merge` (+ `/candidates`) = CRITICAL_DELETE; POST needs `confirm: "MERGE_<sourceId>"` (else 428), awaited `MERGE_CUSTOMER` log. UI `MergeCustomerModal` (typed name confirmation). **A new schema relation to Customer needs a plan row + handler** — `customer-merge-plan.test.ts` parses the schema and fails otherwise.
