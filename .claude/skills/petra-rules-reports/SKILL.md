---
name: petra-rules-reports
description: "Petra reports invariants moved out of CLAUDE.md (rule 30): shared report definitions, computed server-side only. Load BEFORE touching /analytics (\"דוחות\"), report definitions, report API routes, dashboard metrics or any number that must agree between screens."
---

# Petra — Reports — rules

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### 30. Reports — shared definitions, server-side only
Contracts: `src/lib/analytics-types.ts` (`AnalyticsData` → `GET /api/analytics`, `SalesReport` → `GET /api/leads/reports`). Dates: `src/lib/report-dates.ts` (Israel-day bounds `israelDayStart/End`, `israelMonthKey`, `pct` = null on 0 denominator). Never compute report numbers client-side.
- **Lead conversion = won / (won + lost)** everywhere (open leads excluded). Won/lost = CURRENT stage `isWon`/`isLost`; activity basis additionally requires `wonAt`/`lostAt` in range. Pure logic: `src/lib/sales-report.ts` (`buildSalesReport`, `buildLeadSourceRows` — also used by `getAnalytics().leadsBySource`).
- `/analytics` (`src/lib/analytics-metrics.ts`): avg revenue = revenue / **paying** customers; retention = customers active (completed appt or paid payment) in the previous equal period who were active again; completion = completed / due (past, non-canceled); `revenueByService` + `finance.byCategory` cover ALL paid payments (Σ = revenue); day/hour charts exclude canceled; custom range capped ~5y. Money (`finance`, boarding revenue, …) null without `FINANCE_SUMMARY` (permission overrides honoured).
- Outstanding balances: `src/lib/outstanding-balances.ts` (`computeOutstandingBalances`) — shared by `/analytics` and MCP `get_outstanding_balances`.
- **Tier gate is enforced server-side too:** `/api/analytics` + `/api/analytics/export` → `businessHasFeature(prisma, businessId, "analytics")` (`src/lib/feature-gate.ts`, same effective-tier rule as `usePlan`: lapsed subscription → free, `featureOverrides` win) → 403 `FEATURE_LOCKED`. `/api/leads/reports` is NOT tier-gated (`leads` is open on all tiers).
- `/api/leads/reports` = `requireBusinessPermission(ANALYTICS_READ)`; `/leads?view=reports` deep-links the tab. Funnel "reached" uses current stage + `stage_change` log names + `previousStageId`.
- Closer: close-won / close-lost / convert / PATCH stage stamp `wonByUserId` / `lostByUserId` = session PlatformUser id (`updateLead(..., actorUserId)`); MCP passes none → null ("לא תועד").
- Tests: `src/lib/__tests__/{sales-report,analytics-metrics,outstanding-balances,report-dates}.test.ts`.
