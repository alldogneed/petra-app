/**
 * Shared response contracts for the reports module.
 *
 *  - `AnalyticsData`  → GET /api/analytics        (getAnalytics in src/services/business.ts, page /analytics)
 *  - `SalesReport`    → GET /api/leads/reports    (getLeadsReport in src/services/leads-reports.ts, LeadsReports tab in /leads)
 *
 * Money fields are `null` when the caller may not see them (canSeeRevenue / canSeeMoney).
 * Rates are integer percentages (0–100) or `null` when the denominator is 0 ("no data", not 0%).
 * Month keys are "YYYY-MM" in Asia/Jerusalem.
 */
import type { LeadAttributionReport } from "@/lib/lead-attribution";
import type { LeadSalesReport } from "@/lib/lead-deal-value";

// ─── Shared lead definitions ──────────────────────────────────────────────────
// Conversion rate everywhere = won / (won + lost). Open leads are NOT in the denominator.

export type LeadReportBasis =
  /** Leads CREATED in the range; won/lost = their current outcome (cohort). */
  | "cohort"
  /** What HAPPENED in the range: created by createdAt, won by wonAt, lost by lostAt (same as /analytics). */
  | "activity";

export interface LeadSourceRow {
  source: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  conversionRate: number | null;
  /** Sum of dealValue of the won leads in this row (null when money hidden). */
  wonValue: number | null;
}

// ─── /api/analytics ───────────────────────────────────────────────────────────

export type RevenueCategory = "appointments" | "boarding" | "orders" | "training" | "other";

export interface AnalyticsData {
  period: string;
  from: string;
  to: string;
  overview: {
    totalCustomers: number;
    newCustomers: number;
    newCustomersChange: number | null;
    totalAppointments: number;
    appointmentsChange: number | null;
    completedAppointments: number;
    canceledAppointments: number;
    noShowAppointments: number;
    /** completed / (appointments whose date already passed, excl. canceled). */
    completionRate: number;
    completionRateChange: number | null;
    /** canceled / totalAppointments. */
    cancellationRate: number | null;
    noShowRate: number | null;
    revenue: number | null;
    revenueChange: number | null;
    paymentCount: number | null;
  };
  tasks: { open: number; completedThisPeriod: number };
  leads: {
    active: number;
    wonThisPeriod: number;
    lostThisPeriod: number;
    /** won / (won + lost) in period — 0 when no closed leads (kept numeric for backwards compat). */
    conversionRate: number;
    wonChange: number | null;
  };
  /** Leads CREATED in period, grouped by `source`; conversion = won/(won+lost). */
  leadsBySource?: LeadSourceRow[];
  lostReasons?: { code: string; count: number }[];
  leadAttribution?: LeadAttributionReport;
  leadSales?: (LeadSalesReport & { pipelineValue: number; pipelineWithValueCount: number }) | null;
  training: {
    activePrograms: number;
    completedSessionsThisPeriod: number;
    activeGroups: number;
    groupSessionsThisPeriod: number;
    revenue: number | null;
  };
  boarding: {
    staysThisPeriod: number;
    staysChange: number | null;
    /** Room-nights occupied in the period (stays overlapping the period, excl. canceled). */
    occupiedNights: number;
    /** Σ active room capacity × nights in period. 0 when the business has no rooms. */
    capacityNights: number;
    occupancyRate: number | null;
    /** Paid payments linked to a boarding stay, paidAt in period. */
    revenue: number | null;
  };
  /** null when the caller can't see revenue. */
  finance: {
    /** Last 12 calendar months (oldest first), paid payments by paidAt, + same month a year earlier. */
    monthly: { month: string; revenue: number; prevYearRevenue: number }[];
    /** Σ byCategory.revenue === overview.revenue. */
    byCategory: { category: RevenueCategory; label: string; revenue: number }[];
    byMethod: { method: string; label: string; revenue: number; count: number }[];
    /** Revenue in period split by whether the paying customer was created inside the period. */
    newVsReturning: { newCustomers: number; returningCustomers: number };
    /** Distinct customers with a paid payment in period. */
    payingCustomers: number;
    outstanding: {
      total: number;
      customers: number;
      top: { customerId: string; name: string; total: number; oldest: string }[];
    };
  } | null;
  charts: {
    appointmentsByDate: { date: string; count: number }[];
    /** All paid payments in period by service / category — sums to overview.revenue. Empty when money hidden. */
    revenueByService: { name: string; revenue: number }[];
    /** Excludes canceled; day-of-week in Asia/Jerusalem (0 = ראשון). */
    appointmentsByDayOfWeek: { day: string; count: number }[];
    appointmentsByHour: { hour: number; label: string; count: number }[];
  };
  topCustomers: { id: string; name: string; revenue: number; count: number }[];
  petDemographics?: {
    total: number;
    bySpecies: { species: string; count: number }[];
    topBreeds: { breed: string; count: number }[];
  };
  retention: {
    /** Customers active in the PREVIOUS period (≥1 completed appointment / paid payment) who were active again in this period. */
    returningCustomers: number;
    /** Base: customers active in the previous period. */
    customersWithAppointments: number;
    retentionRate: number | null;
    /** revenue / payingCustomers (null when money hidden or no paying customers). */
    avgRevenuePerCustomer: number | null;
  };
}

// ─── /api/leads/reports ───────────────────────────────────────────────────────

export type ResponseBucket = "lt1h" | "1to4h" | "4to24h" | "1to3d" | "gt3d" | "none";
export type AgingBucket = "0-7" | "8-14" | "15-30" | "31-60" | "60+";

export interface SalesReport {
  basis: LeadReportBasis;
  from: string; // ISO
  to: string;   // ISO
  generatedAt: string;
  canSeeMoney: boolean;
  kpis: {
    total: number;
    won: number;
    lost: number;
    /** cohort: leads of the set still open; activity: leads created in range still open. */
    open: number;
    conversionRate: number | null;
    lostRate: number | null;
    /** Mean days createdAt → wonAt over the won leads counted. */
    avgDaysToClose: number | null;
    /** createdAt → first CallLog of a contact type (not stage_change / deal_value), over leads created in range. */
    avgFirstResponseHours: number | null;
    medianFirstResponseHours: number | null;
    respondedCount: number;
    /** Open leads created in range with no contact log at all. */
    unrespondedOpenCount: number;
    wonValue: number | null;
    wonWithValueCount: number;
    avgDealValue: number | null;
    /** Σ dealValue of ALL currently open leads (snapshot, not range-limited). */
    pipelineValue: number | null;
    pipelineWithValueCount: number;
    /** won/(won+lost) over the last 365 days by wonAt/lostAt — used for the forecast. */
    historicalConversionRate: number | null;
    /** pipelineValue × historicalConversionRate. */
    forecastValue: number | null;
  };
  /** Same KPIs for the previous equal-length range (same basis). */
  previous: { total: number; won: number; lost: number; conversionRate: number | null; wonValue: number | null };
  /** Every month in range: created by createdAt, won by wonAt, lost by lostAt (always activity-style, so nothing is cut off). */
  monthly: { month: string; created: number; won: number; lost: number; wonValue: number | null }[];
  bySource: LeadSourceRow[];
  byTrafficSource: LeadSourceRow[];
  byLandingPage: { page: string; total: number; won: number; conversionRate: number | null }[];
  /** Closed leads per closer (wonByUserId / lostByUserId). userId "unknown" = not recorded. */
  byUser: { userId: string; name: string; won: number; lost: number; conversionRate: number | null; wonValue: number | null }[];
  responseTime: { bucket: ResponseBucket; count: number }[];
  /**
   * Active stages by sortOrder, then the won stage.
   * reached = leads of the set that are known to have been at this stage or beyond
   * (current stage index ≥ this one, OR the stage appears in a stage_change log, OR the lead is won).
   */
  funnel: { stageId: string; name: string; color: string; reached: number; current: number; stepConversion: number | null }[];
  /** Currently open leads (snapshot, not range-limited) by age since createdAt. */
  aging: { bucket: AgingBucket; count: number; value: number | null }[];
  /** Open leads per active stage with the oldest lead's age. */
  stale: { stageId: string; name: string; color: string; count: number; oldestDays: number }[];
  lostReasons: { code: string; label: string; count: number }[];
}
