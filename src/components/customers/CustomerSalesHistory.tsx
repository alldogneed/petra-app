"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CheckSquare,
  ChevronDown,
  Coins,
  ExternalLink,
  Handshake,
  Phone,
  Sparkles,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { TRAFFIC_SOURCE_LABELS, isTrafficSource } from "@/lib/lead-attribution";
import { formatIls } from "@/lib/lead-deal-value";
import {
  SALES_JOURNAL_KIND_LABELS,
  TASK_STATUS_LABELS,
  type CustomerSalesHistory as CustomerSalesHistoryData,
  type SalesHistoryLead,
  type SalesJournalEntry,
  type SalesJournalKind,
} from "@/lib/lead-sales-history";

// ─── Data ────────────────────────────────────────────────────────────────────

/**
 * Shared query for the customer's sales history (leads linked via Lead.customerId).
 * Used by the card below and by the "הגיע מליד" chip in the customer header —
 * same key, so only one request is made.
 */
export function useCustomerSalesHistory(customerId: string) {
  return useQuery<CustomerSalesHistoryData>({
    queryKey: ["customer-sales-history", customerId],
    queryFn: () => fetchJSON<CustomerSalesHistoryData>(`/api/customers/${customerId}/sales-history`),
    enabled: !!customerId,
    staleTime: 60_000,
    retry: false,
  });
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

const TZ = "Asia/Jerusalem";
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
const TIME_FMT = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? DATE_FMT.format(d) : "";
}

function fmtDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? `${DATE_FMT.format(d)} · ${TIME_FMT.format(d)}` : "";
}

function daysBetween(fromIso: string, toIso: string | null): number | null {
  const a = toDate(fromIso);
  const b = toIso ? toDate(toIso) : new Date();
  if (!a || !b) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function daysLabel(n: number): string {
  if (n === 0) return "באותו יום";
  if (n === 1) return "יום אחד";
  return `${n} ימים`;
}

function sourceLabel(source: string): string {
  return LEAD_SOURCES.find((s) => s.id === source)?.label ?? source;
}

/** Only accept plain color values from data (hex / rgb / hsl) */
function safeColor(c: string | null | undefined): string {
  if (c && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%]+\))$/i.test(c.trim())) return c.trim();
  return "#94A3B8";
}

const KIND_STYLE: Record<SalesJournalKind, { icon: LucideIcon; cls: string }> = {
  call: { icon: Phone, cls: "bg-sky-50 text-sky-600 border-sky-100" },
  stage_change: { icon: ArrowLeftRight, cls: "bg-violet-50 text-violet-600 border-violet-100" },
  deal_value: { icon: Coins, cls: "bg-amber-50 text-amber-600 border-amber-100" },
  task: { icon: CheckSquare, cls: "bg-slate-50 text-slate-600 border-slate-200" },
  created: { icon: Sparkles, cls: "bg-brand-50 text-brand-600 border-brand-100" },
  won: { icon: Trophy, cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  lost: { icon: XCircle, cls: "bg-red-50 text-red-600 border-red-100" },
};

const STATUS_BADGE: Record<SalesHistoryLead["status"], { label: string; cls: string }> = {
  won: { label: "נסגר כלקוח", cls: "badge-success" },
  lost: { label: "אבד", cls: "badge-danger" },
  open: { label: "פתוח במכירות", cls: "badge-warning" },
};

const TASK_STATUS_CHIP: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-100",
  IN_PROGRESS: "bg-sky-50 text-sky-700 border-sky-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  CANCELED: "bg-slate-50 text-slate-500 border-slate-200",
};

const JOURNAL_PREVIEW = 4;
const NOTES_PREVIEW_CHARS = 220;

// ─── Header chip ─────────────────────────────────────────────────────────────

/** Small "הגיע מליד" chip for the customer header — renders only when sales history exists. */
export function CustomerLeadChip({ customerId, className }: { customerId: string; className?: string }) {
  const { data } = useCustomerSalesHistory(customerId);
  if (!data?.leads?.length) return null;
  const won = data.leads.some((l) => l.status === "won");
  return (
    <button
      type="button"
      onClick={() => document.getElementById("sales-history")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        won
          ? "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
        className
      )}
      title="הצג היסטוריית מכירה"
    >
      <Handshake className="w-3 h-3" />
      הגיע מליד
    </button>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function CustomerSalesHistory({ customerId }: { customerId: string }) {
  const { data, isLoading, isError } = useCustomerSalesHistory(customerId);

  if (isLoading) {
    return (
      <div className="card p-5">
        <PetraLoader variant="inline" className="py-4" />
      </div>
    );
  }
  if (isError || !data?.leads?.length) return null;

  const leads = [...data.leads].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <Handshake className="w-4 h-4 text-brand-500" />
          היסטוריית מכירה
          {leads.length > 1 && <span className="text-xs font-normal text-petra-muted">({leads.length} לידים)</span>}
        </h2>
        <Link href="/leads" className="btn-ghost text-xs">
          <ExternalLink className="w-3.5 h-3.5" />
          פתח בלידים
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {leads.map((lead, i) => (
          <div key={lead.id} className={cn(i > 0 && "pt-5", i < leads.length - 1 && "pb-5")}>
            <LeadSection lead={lead} showName={leads.length > 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoItem({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-petra-muted">{label}</dt>
      <dd className="text-sm text-petra-text break-words">{ltr ? <bdi dir="ltr" className="break-all">{value}</bdi> : value}</dd>
    </div>
  );
}

function LeadSection({ lead, showName }: { lead: SalesHistoryLead; showName: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const status = STATUS_BADGE[lead.status] ?? STATUS_BADGE.open;
  const endIso = lead.status === "won" ? lead.wonAt : lead.status === "lost" ? lead.lostAt : null;
  const duration = daysBetween(lead.createdAt, endIso);
  const trafficLabel =
    lead.trafficSource && lead.trafficSource !== "unknown"
      ? isTrafficSource(lead.trafficSource) ? TRAFFIC_SOURCE_LABELS[lead.trafficSource] : lead.trafficSource
      : null;
  const lostReasonLabel = lead.lostReasonCode
    ? LOST_REASON_CODES.find((r) => r.id === lead.lostReasonCode)?.label ?? lead.lostReasonCode
    : null;
  const lostReason =
    lead.status === "lost"
      ? [lostReasonLabel, lead.lostReasonText?.trim()].filter(Boolean).join(" — ") || null
      : null;

  const journal = lead.journal ?? [];
  const visible = showAll ? journal : journal.slice(-JOURNAL_PREVIEW);

  const notes = lead.notes?.trim() ?? "";
  const notesLong = notes.length > NOTES_PREVIEW_CHARS || notes.split("\n").length > 4;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={status.cls}>{status.label}</span>
          {lead.stage && (
            <span className="inline-flex items-center gap-1.5 text-xs text-petra-text">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: safeColor(lead.stage.color) }} />
              {lead.stage.name}
            </span>
          )}
          {showName && lead.name && <span className="text-xs text-petra-muted">· {lead.name}</span>}
        </div>
        <p className="text-xs text-petra-muted leading-relaxed">
          נפתח {fmtDate(lead.createdAt)}
          {lead.status === "won" && lead.wonAt && <> ← נסגר {fmtDate(lead.wonAt)}</>}
          {lead.status === "lost" && lead.lostAt && <> ← אבד {fmtDate(lead.lostAt)}</>}
          {lead.status === "won" && lead.wonByName && <> · נסגר ע״י {lead.wonByName}</>}
          {duration !== null && (
            <>
              {" · "}
              {lead.status === "open" ? `פתוח ${daysLabel(duration)}` : lead.status === "won" ? `נסגר תוך ${daysLabel(duration)}` : `${daysLabel(duration)} במכירות`}
            </>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 rounded-xl bg-slate-50/70 border border-slate-100 p-3">
        <InfoItem label="מקור" value={sourceLabel(lead.source)} />
        {trafficLabel && <InfoItem label="מקור תנועה" value={trafficLabel} />}
        {lead.landingPage && <InfoItem label="עמוד נחיתה" value={lead.landingPage} ltr />}
        {lead.requestedService && <InfoItem label="שירות מבוקש" value={lead.requestedService} />}
        {lead.dealValue !== null && lead.dealValue !== undefined && (
          <InfoItem label="ערך עסקה" value={formatIls(lead.dealValue)} />
        )}
        <InfoItem label="שיחות" value={String(lead.callCount ?? 0)} />
        {lostReason && <InfoItem label="סיבת אובדן" value={lostReason} />}
        {lead.status === "open" && lead.nextFollowUpAt && (
          <InfoItem label="פולואפ הבא" value={fmtDateTime(lead.nextFollowUpAt)} />
        )}
      </dl>

      {/* Notes */}
      {notes && (
        <div>
          <p className="text-[11px] text-petra-muted mb-1">הערות ליד</p>
          <p className={cn("text-sm text-petra-text whitespace-pre-wrap break-words", notesLong && !notesOpen && "line-clamp-4")}>
            {notes}
          </p>
          {notesLong && (
            <button type="button" onClick={() => setNotesOpen((v) => !v)} className="text-xs text-brand-600 hover:underline mt-1">
              {notesOpen ? "הצג פחות" : "הצג הכל"}
            </button>
          )}
        </div>
      )}

      {/* Journal */}
      {journal.length > 0 && (
        <div>
          <p className="text-[11px] text-petra-muted mb-2">יומן מכירה</p>
          <ol className="relative border-s-2 border-slate-100 ms-3 space-y-4">
            {visible.map((e) => (
              <JournalItem key={e.id} entry={e} />
            ))}
          </ol>
          {journal.length > JOURNAL_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAll && "rotate-180")} />
              {showAll ? "הצג פחות" : `הצג את כל ההיסטוריה (${journal.length})`}
            </button>
          )}
          {lead.journalTruncated && (
            <p className="text-[11px] text-petra-muted mt-1">היומן ארוך — מוצגות הרשומות האחרונות בלבד; רשומות ישנות יותר זמינות בכרטיס הליד.</p>
          )}
        </div>
      )}
    </div>
  );
}

function JournalItem({ entry }: { entry: SalesJournalEntry }) {
  const style = KIND_STYLE[entry.kind] ?? KIND_STYLE.call;
  const Icon = style.icon;
  const isTask = entry.kind === "task";
  const taskStatus = entry.taskStatus ?? "";

  return (
    <li className="relative ps-6">
      <span
        className={cn(
          "absolute -start-[13px] top-0 w-6 h-6 rounded-full border flex items-center justify-center",
          style.cls
        )}
      >
        <Icon className="w-3 h-3" />
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xs font-semibold text-petra-text">{SALES_JOURNAL_KIND_LABELS[entry.kind] ?? entry.kind}</span>
        <span className="text-[11px] text-petra-muted tabular-nums">{fmtDateTime(entry.at)}</span>
      </div>
      {entry.summary && (
        <p className="text-sm text-petra-text whitespace-pre-wrap break-words mt-0.5">{entry.summary}</p>
      )}
      {isTask ? (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {taskStatus && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                TASK_STATUS_CHIP[taskStatus] ?? TASK_STATUS_CHIP.CANCELED
              )}
            >
              {TASK_STATUS_LABELS[taskStatus] ?? taskStatus}
            </span>
          )}
          {entry.taskDue && <span className="text-[11px] text-petra-muted">יעד: {fmtDateTime(entry.taskDue)}</span>}
        </div>
      ) : (
        entry.treatment && (
          <p className="text-xs text-petra-muted whitespace-pre-wrap break-words mt-1 rounded-lg bg-slate-50 px-2 py-1">
            <span className="font-semibold text-petra-text">מה סוכם: </span>
            {entry.treatment}
          </p>
        )
      )}
    </li>
  );
}
