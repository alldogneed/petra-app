"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer, LogIn, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { israelDayKey } from "@/lib/boarding-overlap";
import { addDays, dayMovement, weekStart, weekSummary } from "@/lib/boarding-movements";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  isTentative?: boolean;
  pet: { id: string; name: string; breed: string | null } | null;
  customer: { id: string; name: string; phone: string } | null;
  room: { id: string; name: string } | null;
}

type PendingAction = { stay: Stay; kind: "checkin" | "checkout" } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STATUS_TEXT: Record<string, { label: string; className: string }> = {
  reserved: { label: "ממתין לכניסה", className: "text-amber-600" },
  checked_in: { label: "נכנס", className: "text-emerald-600" },
  checked_out: { label: "יצא", className: "text-slate-500" },
};

function dayDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function formatDateHe(day: string) {
  const d = dayDate(day);
  return `${HE_DAYS[d.getUTCDay()]}, ${d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`;
}

function shortDate(day: string) {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
}

const navBtn =
  "no-print w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 transition-colors";

// ─── Row ──────────────────────────────────────────────────────────────────────

function MovementRow({
  stay,
  time,
  action,
  onAction,
}: {
  stay: Stay;
  time: string;
  action: "checkin" | "checkout" | null;
  onAction: (stay: Stay, kind: "checkin" | "checkout") => void;
}) {
  const status = STATUS_TEXT[stay.status] ?? { label: stay.status, className: "text-petra-muted" };
  return (
    <li className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-12 flex-shrink-0 text-sm font-semibold text-petra-text tabular-nums pt-0.5">{time}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <Link href={`/boarding?stay=${stay.id}`} className="font-semibold text-petra-text hover:text-brand-600 hover:underline">
            {stay.pet?.name ?? "—"}
          </Link>
          {stay.pet?.breed && <span className="text-xs text-petra-muted">{stay.pet.breed}</span>}
        </div>
        <div className="text-xs text-petra-muted mt-0.5 truncate">
          {stay.customer?.name ?? "ללא לקוח"} · {stay.room?.name ?? "ללא חדר"}
        </div>
        <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap">
          <span className={cn("font-medium", status.className)}>{status.label}</span>
          {stay.isTentative && <span className="text-amber-600">⏳ שמור זמנית</span>}
        </div>
      </div>
      {action && (
        <button
          type="button"
          onClick={() => onAction(stay, action)}
          className="no-print flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 font-medium transition-colors"
        >
          {action === "checkin" ? "צ׳ק-אין" : "צ׳ק-אאוט"}
        </button>
      )}
    </li>
  );
}

function MovementCard({
  title,
  icon: Icon,
  stays,
  timeOf,
  actionOf,
  emptyText,
  onAction,
}: {
  title: string;
  icon: React.FC<{ className?: string }>;
  stays: Stay[];
  timeOf: (s: Stay) => string;
  actionOf: (s: Stay) => "checkin" | "checkout" | null;
  emptyText: string;
  onAction: (stay: Stay, kind: "checkin" | "checkout") => void;
}) {
  return (
    <div className="card p-4 break-inside-avoid">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-petra-text flex items-center gap-2">
          <Icon className="w-4 h-4 text-petra-muted" />
          {title}
        </h2>
        <span className="text-sm font-semibold text-petra-muted tabular-nums">{stays.length}</span>
      </div>
      {stays.length === 0 ? (
        <p className="text-sm text-petra-muted py-6 text-center">{emptyText}</p>
      ) : (
        <ul>
          {stays.map((s) => (
            <MovementRow key={s.id} stay={s} time={timeOf(s)} action={actionOf(s)} onAction={onAction} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoardingMovementsPage() {
  const queryClient = useQueryClient();
  const today = israelDayKey(new Date());
  const [date, setDate] = useState(today);
  const [week, setWeek] = useState(() => weekStart(today));
  const [pending, setPending] = useState<PendingAction>(null);

  // Fetch the visible week + the selected day, padded by one day on each side.
  const rangeFrom = addDays(date < week ? date : week, -1);
  const weekEnd = addDays(week, 6);
  const rangeTo = addDays(date > weekEnd ? date : weekEnd, 1);
  const queryKey = ["boarding", "movements", rangeFrom, rangeTo];

  const { data: stays = [], isLoading, isFetching } = useQuery<Stay[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/boarding?from=${rangeFrom}&to=${rangeTo}&status=all`);
      if (!r.ok) throw new Error("שגיאה בטעינת השהיות");
      return r.json();
    },
    placeholderData: (prev) => prev,
  });

  const day = useMemo(() => dayMovement(stays, date), [stays, date]);
  const arrivals = useMemo(
    () => [...day.arrivals].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    [day],
  );
  const departures = useMemo(
    () => [...day.departures].sort((a, b) => new Date(a.checkOut!).getTime() - new Date(b.checkOut!).getTime()),
    [day],
  );
  const summary = useMemo(() => weekSummary(stays, week), [stays, week]);
  const maxInBoarding = Math.max(0, ...summary.days.map((d) => d.inBoarding));

  const statusMutation = useMutation({
    mutationFn: async ({ stay, kind }: { stay: Stay; kind: "checkin" | "checkout" }) => {
      const now = new Date().toISOString();
      const body =
        kind === "checkin"
          ? { status: "checked_in", actualCheckinTime: now }
          : { status: "checked_out", actualCheckoutTime: now };
      const r = await fetch(`/api/boarding/${stay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "העדכון נכשל");
      }
      return r.json();
    },
    onSuccess: (_d, { kind, stay }) => {
      toast.success(kind === "checkin" ? `${stay.pet?.name ?? "הכלב"} נכנס לפנסיון` : `${stay.pet?.name ?? "הכלב"} יצא מהפנסיון`);
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      setPending(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setPending(null);
    },
  });

  const onAction = (stay: Stay, kind: "checkin" | "checkout") => setPending({ stay, kind });

  const isToday = date === today;
  const thisWeek = weekStart(today);

  if (isLoading) return <PetraLoader />;

  return (
    <div className="space-y-4">
      <style>{`.print-header{display:none} @media print { aside,nav,header,[data-topbar],[data-sidebar],.no-print{display:none!important} body{font-size:11px} .modal-overlay{display:none!important} .print-header{display:flex!important;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;margin-bottom:14px;} .print-table-wrap{overflow:visible!important} }`}</style>
      <div className="print-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/petra-logo.png" alt="Petra" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 6 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>כניסות ויציאות — פנסיון</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {formatDateHe(date)} · הופק {new Date().toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
      <BoardingTabs />

      {/* Date navigator */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button onClick={() => setDate((d) => addDays(d, -1))} className={navBtn} title="יום קודם" aria-label="יום קודם">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center min-w-[140px]">
          <h1 className="font-bold text-petra-text">{formatDateHe(date)}</h1>
          {isToday && <div className="text-xs text-brand-600 font-medium">היום</div>}
        </div>
        <button onClick={() => setDate((d) => addDays(d, 1))} className={navBtn} title="יום הבא" aria-label="יום הבא">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {!isToday && (
          <button
            onClick={() => { setDate(today); setWeek(weekStart(today)); }}
            className="no-print text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
          >
            היום
          </button>
        )}
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
            setDate(e.target.value);
            setWeek(weekStart(e.target.value));
          }}
          className="no-print input w-auto py-1.5 text-sm"
          aria-label="בחירת תאריך"
        />
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["boarding", "movements"] })}
          className={cn(navBtn, isFetching && "animate-spin")}
          title="רענון"
          aria-label="רענון"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => window.print()} className="no-print btn-primary flex items-center gap-1.5">
          <Printer className="w-4 h-4" />הדפסה
        </button>
      </div>

      {/* Day lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MovementCard
          title={isToday ? "כניסות היום" : "כניסות"}
          icon={LogIn}
          stays={arrivals}
          timeOf={(s) => formatTime(s.checkIn)}
          actionOf={(s) => (s.status === "reserved" ? "checkin" : null)}
          emptyText="אין כניסות מתוכננות ביום זה"
          onAction={onAction}
        />
        <MovementCard
          title={isToday ? "יציאות היום" : "יציאות"}
          icon={LogOut}
          stays={departures}
          timeOf={(s) => (s.checkOut ? formatTime(s.checkOut) : "—")}
          actionOf={(s) => (s.status === "checked_in" ? "checkout" : null)}
          emptyText="אין יציאות מתוכננות ביום זה"
          onAction={onAction}
        />
      </div>

      {/* Weekly summary */}
      <div className="card p-4 break-inside-avoid">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h2 className="font-bold text-petra-text flex-1">
            סיכום שבועי <span className="text-sm font-normal text-petra-muted">{shortDate(week)}–{shortDate(weekEnd)}</span>
          </h2>
          <button onClick={() => setWeek((w) => addDays(w, -7))} className={navBtn} title="שבוע קודם" aria-label="שבוע קודם">
            <ChevronRight className="w-4 h-4" />
          </button>
          {week !== thisWeek && (
            <button
              onClick={() => setWeek(thisWeek)}
              className="no-print text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
            >
              השבוע
            </button>
          )}
          <button onClick={() => setWeek((w) => addDays(w, 7))} className={navBtn} title="שבוע הבא" aria-label="שבוע הבא">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="print-table-wrap overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-[640px] text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-right font-medium text-petra-muted py-2 pe-3" />
                {summary.days.map((d) => (
                  <th
                    key={d.day}
                    className={cn(
                      "text-center font-medium py-2 px-1",
                      d.day === today ? "text-brand-600 bg-brand-50 rounded-t-lg" : "text-petra-muted",
                    )}
                  >
                    <button type="button" onClick={() => setDate(d.day)} className="hover:underline">
                      <div>{HE_DAYS[dayDate(d.day).getUTCDay()]}</div>
                      <div className="text-xs font-normal">{shortDate(d.day)}</div>
                    </button>
                  </th>
                ))}
                <th className="text-center font-semibold text-petra-text py-2 px-1">סה״כ שבועי</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "כניסות", value: (i: number) => summary.days[i].arrivals.length, total: String(summary.totalArrivals) },
                { label: "יציאות", value: (i: number) => summary.days[i].departures.length, total: String(summary.totalDepartures) },
                { label: "בפנסיון בסוף היום", value: (i: number) => summary.days[i].inBoarding, total: maxInBoarding ? `שיא ${maxInBoarding}` : "—" },
              ].map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <th className="text-right font-medium text-petra-text py-2 pe-3 whitespace-nowrap">{row.label}</th>
                  {summary.days.map((d, i) => (
                    <td
                      key={d.day}
                      className={cn(
                        "text-center py-2 px-1 tabular-nums",
                        d.day === today && "bg-brand-50 font-semibold text-brand-700",
                        d.day === date && d.day !== today && "font-semibold",
                      )}
                    >
                      {row.value(i)}
                    </td>
                  ))}
                  <td className="text-center py-2 px-1 font-semibold text-petra-text tabular-nums whitespace-nowrap">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={pending != null}
        title={pending?.kind === "checkin" ? "צ׳ק-אין" : "צ׳ק-אאוט"}
        description={
          pending
            ? pending.kind === "checkin"
              ? `לרשום כניסה של ${pending.stay.pet?.name ?? "הכלב"} עכשיו?`
              : `לרשום יציאה של ${pending.stay.pet?.name ?? "הכלב"} עכשיו?`
            : undefined
        }
        confirmLabel={pending?.kind === "checkin" ? "בצע צ׳ק-אין" : "בצע צ׳ק-אאוט"}
        loading={statusMutation.isPending}
        onConfirm={() => pending && statusMutation.mutate(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
