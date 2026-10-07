---
name: petra-rules-leads
description: "Petra leads invariants moved out of CLAUDE.md (rules 18, 19, 27, 28, 31): kanban sort vs overdue badge must match, PRO-only lead WhatsApp notifications and the petra_biz_lead_alert template, traffic attribution (trafficSource is not source, lead-attribution.ts), dealValue is not revenue, the lead journal follows the customer (sales history). Load BEFORE touching leads/page.tsx, /api/leads*, /api/webhooks/lead, lead stages, lead cards, lead reports or anything reading Lead.dealValue / trafficSource."
---

# Petra — Leads — rules

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### 18. Leads Kanban — sort vs badge must match
`sortLeadsByPriority()` at bottom of `leads/page.tsx`: priority 0 = overdue.
Overdue condition: `followUpDate && followUpDate < todayStart` (no `followUpStatus` check).
Card badge uses identical condition — never add extra conditions to one without updating the other.

### 19. Lead notifications — PRO+ only
`lead_notifications` feature flag in `src/lib/feature-flags.ts`: true for `pro` + `service_dog` only.
When a new lead is created (manual or via webhook), `POST /api/leads` fires-and-forgets a WhatsApp to the business owner's phone.
Uses approved template `petra_biz_lead_alert` (WABA `25882288788086856`) with fallback to free-form.
Body params order: `[lead.name, lead.phone || "לא צוין", lead.requestedService || "לא צוין"]`.
For non-PRO businesses the feature is silently skipped (no UI shown in leads page — handled by TierGate elsewhere).

### 27. Lead traffic attribution — `trafficSource` ≠ `source`
`Lead.source` (existing) = intake channel picked by the business (`manual`/`website`/`google`…, `LEAD_SOURCES` in constants). `Lead.trafficSource` (+ `medium`, `campaign`, `landingPage`, `referrer`, `firstPage`, `gclid`, `pageType`) = where the visitor came from, sent by all-dog.co.il / Make via `POST /api/webhooks/lead` (`utm_*`, `gclid`, `referrer`, `landing_page`, `first_page`, `page_type`, snake or camelCase). Never merge the two fields.
Single source of truth: `src/lib/lead-attribution.ts` — `TRAFFIC_SOURCES` (organic|paid|direct|referral|social|whatsapp|phone|unknown, plain strings, no Prisma enum), `classifyTrafficSource()` (gclid/cpc/ppc → paid; google/bing referrer → organic; facebook/instagram → social; wa.me → whatsapp; all empty → direct; else referral), `normalizeAttributionInput()` (length caps, page URLs stored as path). Body without any attribution key → `unknown` (legacy clients unchanged); keys present but empty → `direct`.
MCP: `create_lead` accepts the same keys (omitted → `unknown`), `get_lead` prints a "מקור תנועה" line. Card + `LeadDetailsModal` render `formatAttributionLine()` ("מקור: אורגני · עמוד: /guides/…"); hidden when `unknown` and no page. Analytics: `getAnalytics().leadAttribution` = fixed 12-month window (`buildLeadAttributionReport`), independent of the period picker. Prod DDL: `prisma/lead_attribution.sql` (additive, default `unknown`). Tests: `src/lib/__tests__/lead-attribution.test.ts`.

### 28. Lead deal value — `dealValue` is NOT revenue
`Lead.dealValue Float?` ("ערך עסקה", ILS) — manual amount; `null` = not entered (≠ 0). Single source of truth: `src/lib/lead-deal-value.ts` (`normalizeDealValue`, `sumDealValues`, `formatIls`, `buildLeadSalesReport`, `EXCLUDED_ORDER_STATUSES`).
- **Edited only in the lead card** (`LeadTreatmentModal` → "ערך עסקה", saved independently via `PATCH /api/leads/[id] {dealValue}`; "שמור וסגור" flushes an open edit first). `updateLead()` writes a `CallLog` `type: "deal_value"` journal line on every change.
- `deal_value` logs are NOT contact activity: kanban card status/snippet and `sortLeadsByPriority()` ignore them (keep rule #18 consistent).
- Kanban column header = `sumDealValues(visible leads in column)` (hidden when 0); archive drop zones + archive table show it too.
- Reports: `getAnalytics().leadSales` (gated by `canSeeRevenue`) = leads won in period (same won definition as `wonThisPeriod`) → deal value + orders the linked customer placed since `wonAt` (excl. cancelled; each order attributed to the customer's most recent won lead → no double count) + `pipelineValue` of open leads. Never add it into `overview.revenue`. Mirrored in analytics Excel export ("מכירות מלידים" sheet), `LeadsReports` KPIs, leads CSV column.
- MCP: `create_lead`/`update_lead` accept `deal_value` (update: `null` clears), `get_lead` prints "💰 ערך עסקה", `get_analytics` prints the lead-sales line. Prod DDL: `prisma/lead_deal_value.sql`. Tests: `src/lib/__tests__/lead-deal-value.test.ts`.

### 31. Customer sales history — the lead journal follows the customer
Everything recorded on a lead (call logs + "מה סוכם", stage changes, deal-value changes, follow-up tasks open+closed, created/won/lost, deal value, source, attribution, who closed) is shown in the customer file for every lead with `Lead.customerId` = that customer (won, lost and open; newest first).
- Single source of truth: `src/lib/lead-sales-history.ts` (types + `buildSalesJournal()` + `leadStatusOf()` + caps); service `getCustomerSalesHistory()` in `src/services/clients.ts`; API `GET /api/customers/[id]/sales-history` (same `CUSTOMERS_PII` gate as the customer GET).
- UI: `src/components/customers/CustomerSalesHistory.tsx` — card "היסטוריית מכירה" in the customer page right column right after Pets (anchor `#sales-history`) + "הגיע מליד" chip in the header. Each lead has "פתח את הליד" → `/leads?lead=<id>` (leads page opens `LeadTreatmentModal` for that id, then strips the param; unknown id → toast). MCP `get_client` appends the section when the token also has `read:leads`.
- `close-won` / `convert` / `updateLead(…, actorUserId)` (stage → won via PATCH) set `wonByUserId` (PlatformUser id; cleared when the lead leaves won); names resolved only via this business's `BusinessUser` rows. `convert` and `close-won` both run `clearLeadFollowUps()` so a won lead has no open follow-up. Never delete callLogs/tasks of a converted lead — they ARE the customer's sales history. Tests: `src/lib/__tests__/lead-sales-history.test.ts`.
