"use client";

import Link from "next/link";
import { AlertCircle, CalendarClock, CheckCircle2, CreditCard, History, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatDayDate, type CustomerSummary } from "./types";

/**
 * Top-of-card summary: next appointment, balance, visits, last visit, total paid.
 * Every number comes from the server (`customer.summary`) — nothing is summed on the client.
 */
export function SummaryStrip({
  summary,
  canSeeFinance,
  canWritePayments,
  onBook,
  onRecordPayment,
}: {
  summary: CustomerSummary | undefined;
  canSeeFinance: boolean;
  canWritePayments: boolean;
  onBook: () => void;
  onRecordPayment: () => void;
}) {
  const next = summary?.nextAppointment ?? null;
  const last = summary?.lastVisit ?? null;
  const balance = canSeeFinance ? summary?.balance ?? null : null;
  const outstanding = balance?.outstanding ?? 0;

  return (
    <div className="space-y-3">
      {balance && outstanding > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">חוב {formatCurrency(outstanding)}</p>
            {balance.pendingAmount > 0 && (
              <p className="text-xs text-red-600/80">מתוכם {formatCurrency(balance.pendingAmount)} בתשלומים ממתינים</p>
            )}
          </div>
          {canWritePayments && (
            <button onClick={onRecordPayment} className="btn-primary text-xs py-1.5 px-3 !bg-red-600 hover:!bg-red-700">
              <CreditCard className="w-3.5 h-3.5" />
              רשום תשלום
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Next appointment */}
        <div className="col-span-2 card p-3.5 flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-4 h-4 text-brand-600" />
          </div>
          {next ? (
            <Link
              href={`/calendar?date=${String(next.date).slice(0, 10)}&apt=${next.id}`}
              className="flex-1 min-w-0 group"
              title="פתח את התור ביומן"
            >
              <p className="text-[11px] text-petra-muted">התור הבא</p>
              <p className="text-sm font-bold text-petra-text truncate group-hover:text-brand-600">
                {formatDayDate(next.date)} · {next.startTime}
              </p>
              <p className="text-xs text-petra-muted truncate">
                {[next.serviceName, next.petName].filter(Boolean).join(" · ") || "תור"}
              </p>
            </Link>
          ) : (
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-petra-muted">התור הבא</p>
                <p className="text-sm text-petra-muted">אין תור עתידי</p>
              </div>
              <button onClick={onBook} className="btn-ghost text-xs flex-shrink-0">
                <Plus className="w-3.5 h-3.5" />
                קבע תור
              </button>
            </div>
          )}
        </div>

        {/* Visits / last visit */}
        <div className="card p-3.5 min-w-0">
          <p className="text-[11px] text-petra-muted flex items-center gap-1">
            <History className="w-3 h-3" />
            ביקורים
          </p>
          <p className="text-lg font-bold text-petra-text leading-tight">{summary?.counts.pastVisits ?? 0}</p>
          <p className="text-[11px] text-petra-muted truncate">
            {last ? `אחרון: ${formatDayDate(last.date)}` : "טרם ביקר"}
          </p>
        </div>

        {/* Balance / total paid */}
        {balance ? (
          <div className="card p-3.5 min-w-0">
            <p className="text-[11px] text-petra-muted flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              שולם עד היום
            </p>
            <p className="text-lg font-bold text-petra-text leading-tight">{formatCurrency(balance.totalPaid)}</p>
            {outstanding > 0 ? (
              <p className="text-[11px] font-medium text-red-600 truncate">חוב {formatCurrency(outstanding)}</p>
            ) : (
              <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                אין חוב
              </p>
            )}
          </div>
        ) : (
          <div className="card p-3.5 min-w-0">
            <p className="text-[11px] text-petra-muted">תורים</p>
            <p className="text-lg font-bold text-petra-text leading-tight">{summary?.counts.appointments ?? 0}</p>
            <p className="text-[11px] text-petra-muted truncate">{summary?.counts.upcomingAppointments ?? 0} עתידיים</p>
          </div>
        )}
      </div>
    </div>
  );
}
