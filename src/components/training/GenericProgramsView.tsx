"use client";

/**
 * "תוכניות" — the /training screen for a "generic"-vertical business (docs/verticals).
 *
 * Same module, same API, same TrainingProgram rows as the dog training screen — only the
 * view differs: a program belongs to a customer (no dog), has an optional number of
 * meetings and a price, and is advanced by logging meetings. The dog training page
 * (training/page.tsx) is untouched and is what every "dogs" business keeps seeing.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/CustomerPicker";
import { cn, fetchJSON, formatCurrency, formatDate } from "@/lib/utils";
import { PROGRAM_STATUS_MAP } from "@/lib/training-programs";
import { triggerLimitModal } from "@/lib/limit-reached";

interface GenericProgram {
  id: string;
  name: string;
  status: string;
  startDate: string;
  totalSessions: number | null;
  price: number | null;
  customer: { id: string; name: string; phone: string | null } | null;
  sessions: { id: string; status: string; sessionDate: string; summary: string | null }[];
}

type Tab = "active" | "done";

function completedCount(p: GenericProgram) {
  return p.sessions.filter((s) => s.status === "COMPLETED").length;
}

export function GenericProgramsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const [showNew, setShowNew] = useState(false);
  const [logFor, setLogFor] = useState<GenericProgram | null>(null);
  const [search, setSearch] = useState("");

  const { data: programs = [], isLoading } = useQuery<GenericProgram[]>({
    queryKey: ["training-programs", "generic"],
    queryFn: () => fetchJSON<GenericProgram[]>("/api/training-programs"),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs
      .filter((p) => (tab === "active" ? ["ACTIVE", "PAUSED"].includes(p.status) : ["COMPLETED", "CANCELED"].includes(p.status)))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.customer?.name ?? "").toLowerCase().includes(q));
  }, [programs, tab, search]);

  const activeCount = programs.filter((p) => ["ACTIVE", "PAUSED"].includes(p.status)).length;

  const finish = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/training-programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      toast.success("התוכנית הסתיימה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון התוכנית"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">תוכניות</h1>
          <p className="text-sm text-petra-muted">חבילות מפגשים ותוכניות ללקוחות · {activeCount} פעילות</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" />
          תוכנית חדשה
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit" role="tablist">
          {([["active", "פעילות"], ["done", "הסתיימו"]] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === key ? "bg-white text-petra-text shadow-sm" : "text-petra-muted hover:text-petra-text"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          placeholder="חיפוש לפי תוכנית או לקוח..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center">
          <ClipboardList className="w-8 h-8 text-petra-muted mx-auto mb-3" />
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {tab === "active" ? "אין תוכניות פעילות" : "אין תוכניות שהסתיימו"}
          </h3>
          <p className="text-sm text-petra-muted">
            תוכנית נפתחת כאן, או אוטומטית מהזמנה של חבילת מפגשים.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((p) => {
            const done = completedCount(p);
            const total = p.totalSessions ?? 0;
            const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
            const status = PROGRAM_STATUS_MAP[p.status];
            return (
              <div key={p.id} className="card p-5 space-y-3" data-testid="generic-program">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-petra-text truncate">{p.name}</h3>
                    {p.customer && (
                      <Link href={`/customers/${p.customer.id}`} className="text-xs text-brand-600 hover:underline">
                        {p.customer.name}
                      </Link>
                    )}
                  </div>
                  {status && (
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border flex-shrink-0", status.color)}>
                      {status.label}
                    </span>
                  )}
                </div>

                <div className="text-xs text-petra-muted flex items-center gap-3 flex-wrap">
                  <span>{total > 0 ? `${done}/${total} מפגשים` : `${done} מפגשים`}</span>
                  <span>התחלה: {formatDate(p.startDate)}</span>
                  {p.price != null && <span>{formatCurrency(p.price)}</span>}
                </div>

                {pct !== null && (
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {["ACTIVE", "PAUSED"].includes(p.status) && (
                  <div className="flex gap-2 pt-1">
                    <button className="btn-secondary text-xs flex-1" onClick={() => setLogFor(p)}>
                      תיעוד מפגש
                    </button>
                    <button
                      className="btn-ghost text-xs"
                      disabled={finish.isPending}
                      onClick={() => finish.mutate(p.id)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      סיום תוכנית
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewProgramModal onClose={() => setShowNew(false)} />}
      {logFor && <LogSessionModal program={logFor} onClose={() => setLogFor(null)} />}
    </div>
  );
}

function NewProgramModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState<PickerCustomer | null>(null);
  const [name, setName] = useState("");
  const [totalSessions, setTotalSessions] = useState("");
  const [price, setPrice] = useState("");

  const create = useMutation({
    mutationFn: () =>
      fetchJSON("/api/training-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          customerId: customer?.id,
          programType: "CUSTOM",
          trainingType: "HOME",
          totalSessions: totalSessions ? Number(totalSessions) : null,
          price: price ? Number(price) : null,
          isPackage: !!totalSessions,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      toast.success("התוכנית נוצרה");
      onClose();
    },
    onError: (e: Error & { code?: string }) => {
      if (e.code === "LIMIT_REACHED") triggerLimitModal(e.message);
      else toast.error(e.message || "שגיאה ביצירת התוכנית");
    },
  });

  const canSave = !!customer && name.trim().length > 0 && !create.isPending;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6" role="dialog" aria-modal="true" aria-labelledby="new-program-title">
        <div className="flex items-center justify-between mb-5">
          <h2 id="new-program-title" className="text-lg font-bold text-petra-text">תוכנית חדשה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">לקוח *</label>
            <CustomerPicker
              value={customer?.id ?? null}
              selectedCustomer={customer}
              onSelect={(c) => setCustomer(c)}
              onClear={() => setCustomer(null)}
            />
          </div>
          <div>
            <label className="label">שם התוכנית *</label>
            <input className="input w-full" placeholder="לדוגמה: חבילת 10 מפגשים" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">כמות מפגשים</label>
              <input className="input w-full" type="number" min={1} max={1000} dir="ltr" value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} />
            </div>
            <div>
              <label className="label">מחיר (₪)</label>
              <input className="input w-full" type="number" min={0} dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button className="btn-primary flex-1" disabled={!canSave} onClick={() => create.mutate()}>
              {create.isPending ? "שומר..." : "צור תוכנית"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogSessionModal({ program, onClose }: { program: GenericProgram; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState("");

  const log = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/training-programs/${program.id}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDate: new Date(`${date}T12:00:00`).toISOString(),
          durationMinutes: 60,
          summary: summary.trim() || undefined,
          status: "COMPLETED",
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-programs"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
      toast.success("המפגש תועד");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בתיעוד המפגש"),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-6" role="dialog" aria-modal="true" aria-labelledby="log-session-title">
        <div className="flex items-center justify-between mb-5">
          <h2 id="log-session-title" className="text-lg font-bold text-petra-text">תיעוד מפגש — {program.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" aria-label="סגור">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">תאריך</label>
            <input className="input w-full" type="date" lang="he" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">סיכום (אופציונלי)</label>
            <textarea className="input w-full min-h-[80px]" maxLength={5000} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex-1" disabled={log.isPending || !date} onClick={() => log.mutate()}>
              {log.isPending ? "שומר..." : "שמור מפגש"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}
