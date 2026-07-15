# Workshops Operational Management — Design (2026-07-15)

Approved by Or: Approach A (extend the existing TrainingGroup model), operational-management focus.
Constraint: code is NOT deployed to production; review happens on localhost. The shared DB gets one
additive nullable column + an isolated `design-test` demo business.

## Goal

Give trainers real operational control over workshops (`TrainingGroup.groupType === "WORKSHOP"`):
price, capacity, waitlist with manual promotion, per-participant payment tracking linked to real
Orders, and per-participant attendance visibility.

## What already exists (reused, not rebuilt)

- Workshop = `TrainingGroup` with `groupType="WORKSHOP"`; sub-tab "סדנאות מיוחדות" in `training/page.tsx`.
- `TrainingGroup.maxParticipants Int?` — capacity field already in schema.
- `TrainingGroupParticipant.orderId String?` + relation `OrderGroupParticipants` — already in schema.
- `TrainingGroupParticipant.status String` (ACTIVE | PAUSED | DROPPED | COMPLETED) — new WAITLIST value needs no migration.
- Sessions, per-session attendance (`TrainingGroupAttendance`, statuses PRESENT | NO_SHOW | CANCELED | MAKEUP),
  attendance auto-seeded on session creation for ACTIVE participants, WhatsApp session reminders,
  convert-participant-to-program.

## Schema change (single, additive)

```prisma
model TrainingGroup {
  price Float?   // workshop price in ILS, per whole workshop (not per session)
}
```

Applied to the shared DB via Supabase migration (`ALTER TABLE "TrainingGroup" ADD COLUMN "price" DOUBLE PRECISION;`),
`schema.production.prisma` synced and committed (NOT pushed).

## Capacity semantics

- Capacity counts **ACTIVE participants only**. WAITLIST/DROPPED/PAUSED don't consume seats.
- Full = `activeCount >= maxParticipants` (when maxParticipants set).

## API contract

All routes follow `requireBusinessAuth` + service-layer ownership checks (group/participant must belong to the session business — IDOR rule).

1. `POST/PATCH /api/training-groups[/id]` — accept `price` (number|null, 0..100000) alongside existing fields (maxParticipants already accepted or added).
2. `GET /api/training-groups` — each group gains `price`; each participant gains:
   - `status` (may be `WAITLIST`), `orderId`
   - `order: { id, status, total, paidAmount } | null` (paidAmount = sum of order.payments)
   - `attendedCount` (PRESENT rows), `heldCount` (attendance rows whose session is COMPLETED or in the past)
3. `POST /api/training-groups/[id]/participants` — when group is full, create with `status: "WAITLIST"`
   instead of rejecting (response includes the status so UI toasts accordingly). When created ACTIVE,
   seed NO_SHOW attendance rows for all future SCHEDULED sessions (fixes the "joined after sessions existed" gap).
4. `PATCH /api/training-groups/[id]/participants/[participantId]` with `{ action: "promote" }` —
   WAITLIST→ACTIVE; 409 with Hebrew message if the group is full; seeds future attendance on success.
5. `POST /api/training-groups/[id]/participants/[participantId]/order` — creates a confirmed Order
   (orderType "training", relatedEntityType "TrainingGroup", relatedEntityId=groupId,
   one OrderLine named `סדנה: <group.name>`, total = group.price), links `participant.orderId`.
   409 if participant already has an order; 400 if group has no price. Returns the order + data the
   UI needs for the WhatsApp payment-request message (customer name/phone, business phone).
   Payment-request message MUST include a clickable payment link when available (Stripe checkout if the
   business has Stripe connected — reuse the existing payment-request/Stripe helpers; otherwise message
   without link and the trainer records payment manually via the orders screen).
6. `POST /api/training-groups/[id]/sessions/[sessionId]/attendance` — idempotent seeding of attendance
   rows for all current ACTIVE participants (skipDuplicates). Optional body `{ markAll: "PRESENT" }`
   bulk-sets every row. Fixes the chicken-and-egg (button hidden when 0 rows) for legacy sessions.
7. Existing `PATCH /api/training-attendance/[id]` unchanged (per-row status/notes).

## UI (training/page.tsx — WorkshopsTab + GroupCard when isWorkshop)

- **Create/Edit modal**: for workshops add מחיר (₪) and קיבולת fields (keep optional).
- **Card header chips**: capacity `7/10` (amber "מלא" when full), price `₪450`.
- **Participants table** (replaces the plain grid for workshops): dog+customer, payment chip
  (אין הזמנה / ממתין לתשלום / שולם חלקית / שולם), attendance `נכח 2/4`, actions:
  צור דרישת תשלום (creates order via #5 then opens wa.me with the message), הסר, המר לאילוף.
- **Waitlist section**: "רשימת המתנה (N)" with per-row "קדם" button (disabled + tooltip when full).
- **Revenue line**: "נגבה ₪X מתוך ₪Y" (paid sum vs. active-participant count × price).
- **Attendance**: "סמן נוכחות" always visible (calls #6 to seed when empty, then opens the panel);
  panel gains "סמן את כולם כנוכחים".
- Patterns: Tailwind + existing aliases, RTL, sonner toasts, React Query invalidation of
  `["training-groups"]` (+ calendar key where sessions change).

## Demo data (isolated business in the shared DB)

Recreate `design-test@petra.local` / `designTest123` + "Design Test Business" (tier `pro`):
8 Hebrew-named customers with dogs; two workshops:
- "סדנת גן גורים — יולי": 4 weekly sessions (2 past, 2 future), price ₪450, capacity 6,
  6 ACTIVE + 2 WAITLIST, attendance marked on past sessions (mix PRESENT/NO_SHOW),
  3 paid orders / 2 unpaid orders / 1 without order.
- "סדנה חד־פעמית — כלבים ריאקטיביים": 1 future session, price ₪180, capacity 8, 4 ACTIVE (1 paid).

## Testing & security

- Full `tsc --noEmit` must pass.
- Local dev server + Playwright: login as design-test, open אילוף → קבוצות → סדנאות מיוחדות,
  screenshots of card (capacity/payments/waitlist/attendance) for Or's review.
- Security review of the diff: IDOR (ownership on every new route), input validation (price bounds,
  enum whitelists for action/markAll), no businessId from client, no new public routes.

## Out of scope (explicitly)

Public self-registration page, online checkout webhooks for workshops, marketing pages,
auto-promotion from waitlist, per-session pricing.
