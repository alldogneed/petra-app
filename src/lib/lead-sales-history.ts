/**
 * Customer sales history — everything recorded on a lead in the sales module
 * (call logs, stage changes, deal-value changes, follow-up tasks, won/lost info)
 * surfaced inside the customer file once the lead is linked to a customer.
 *
 * Single source of truth for the shape returned by
 *   GET /api/customers/[id]/sales-history   (getCustomerSalesHistory in src/services/clients.ts)
 * and rendered by the customer page + MCP get_client.
 *
 * Pure module — no Prisma / server imports, safe for client components.
 */

export type SalesJournalKind = "call" | "stage_change" | "deal_value" | "task" | "created" | "won" | "lost";

export interface SalesJournalEntry {
  id: string;
  kind: SalesJournalKind;
  at: string; // ISO
  /** Main line (call summary / stage change text / task title / system line) */
  summary: string;
  /** "מה סוכם" — call treatment, or task status label for tasks */
  treatment?: string | null;
  /** Task-only extras */
  taskStatus?: string | null;
  taskDue?: string | null; // ISO
}

export interface SalesHistoryLead {
  id: string;
  name: string;
  phone: string | null;
  source: string;
  requestedService: string | null;
  notes: string | null;
  stage: { id: string; name: string; color: string | null; isWon: boolean; isLost: boolean } | null;
  status: "won" | "lost" | "open";
  createdAt: string;
  wonAt: string | null;
  wonByName: string | null;
  lostAt: string | null;
  lostReasonCode: string | null;
  lostReasonText: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  dealValue: number | null;
  trafficSource: string;
  landingPage: string | null;
  campaign: string | null;
  medium: string | null;
  /** Number of real contact interactions (type "call") */
  callCount: number;
  /** Chronological, oldest → newest */
  journal: SalesJournalEntry[];
  /** True when the journal hit the per-lead cap and older rows were dropped */
  journalTruncated: boolean;
}

export interface CustomerSalesHistory {
  customerId: string;
  /** Newest lead first */
  leads: SalesHistoryLead[];
}

/** Max call logs / tasks loaded per lead */
export const SALES_HISTORY_MAX_LOGS = 300;
export const SALES_HISTORY_MAX_TASKS = 100;
/** Max leads per customer shown */
export const SALES_HISTORY_MAX_LEADS = 20;

export const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "פתוחה",
  IN_PROGRESS: "בתהליך",
  COMPLETED: "הושלמה",
  CANCELED: "בוטלה",
};

export const SALES_JOURNAL_KIND_LABELS: Record<SalesJournalKind, string> = {
  call: "שיחה / פולואפ",
  stage_change: "שינוי שלב",
  deal_value: "ערך עסקה",
  task: "משימת מעקב",
  created: "ליד נפתח",
  won: "נסגר כלקוח",
  lost: "אבד",
};

type DateLike = Date | string | null | undefined;

function iso(d: DateLike): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

export interface RawCallLog {
  id: string;
  type: string;
  summary: string;
  treatment: string | null;
  createdAt: DateLike;
}

export interface RawLeadTask {
  id: string;
  title: string;
  status: string;
  dueAt: DateLike;
  dueDate: DateLike;
  completedAt: DateLike;
  createdAt: DateLike;
}

/**
 * Merge a lead's call logs + follow-up tasks + lifecycle markers (created / won / lost)
 * into one chronological journal (oldest → newest). Ties keep a stable, logical order:
 * created first, won/lost last.
 */
export function buildSalesJournal(input: {
  leadId: string;
  createdAt: DateLike;
  wonAt?: DateLike;
  lostAt?: DateLike;
  lostReasonLabel?: string | null;
  callLogs: RawCallLog[];
  tasks: RawLeadTask[];
}): SalesJournalEntry[] {
  const entries: Array<SalesJournalEntry & { _order: number }> = [];

  const created = iso(input.createdAt);
  if (created) entries.push({ id: `${input.leadId}:created`, kind: "created", at: created, summary: "הליד נפתח במודול המכירות", _order: 0 });

  for (const c of input.callLogs) {
    const at = iso(c.createdAt);
    if (!at) continue;
    const kind: SalesJournalKind = c.type === "stage_change" ? "stage_change" : c.type === "deal_value" ? "deal_value" : "call";
    const treatment = c.treatment && c.treatment.trim() ? c.treatment.trim() : null;
    entries.push({ id: c.id, kind, at, summary: c.summary ?? "", treatment, _order: 1 });
  }

  for (const t of input.tasks) {
    const at = iso(t.createdAt);
    if (!at) continue;
    entries.push({
      id: t.id,
      kind: "task",
      at,
      summary: t.title,
      taskStatus: t.status,
      treatment: TASK_STATUS_LABELS[t.status] ?? t.status,
      taskDue: iso(t.dueAt) ?? iso(t.dueDate),
      _order: 1,
    });
  }

  const won = iso(input.wonAt);
  if (won) entries.push({ id: `${input.leadId}:won`, kind: "won", at: won, summary: "הליד נסגר בהצלחה והפך ללקוח", _order: 2 });
  const lost = iso(input.lostAt);
  if (lost) entries.push({ id: `${input.leadId}:lost`, kind: "lost", at: lost, summary: input.lostReasonLabel ? `הליד סומן כאבוד — ${input.lostReasonLabel}` : "הליד סומן כאבוד", _order: 2 });

  entries.sort((a, b) => (a.at === b.at ? a._order - b._order : a.at < b.at ? -1 : 1));
  return entries.map(({ _order, ...e }) => { void _order; return e; });
}

export function leadStatusOf(lead: { wonAt: DateLike; lostAt: DateLike }, stage?: { isWon: boolean; isLost: boolean } | null): "won" | "lost" | "open" {
  if (stage?.isWon || (lead.wonAt && !stage?.isLost)) return "won";
  if (stage?.isLost || lead.lostAt) return "lost";
  return "open";
}
