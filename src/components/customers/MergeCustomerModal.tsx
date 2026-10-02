"use client";

/**
 * Merge a duplicate customer INTO the customer whose card is open.
 * Step 1: pick the duplicate (suggestions: same phone / email / name, or search).
 * Step 2: preview what moves + typed confirmation (type the duplicate's name) → merge.
 * API: /api/customers/[id]/merge (+ /candidates). Requires CRITICAL_DELETE.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, GitMerge, Search, X, AlertTriangle, PawPrint, Phone } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  MERGE_RELATIONS, mergeConfirmToken, type MergeCounts,
} from "@/lib/customer-merge-plan";

export interface MergeCustomerModalProps {
  /** The customer that stays (the card that is open). */
  targetId: string;
  targetName: string;
  onClose: () => void;
  /** Called after a successful merge (the duplicate no longer exists). */
  onMerged: () => void;
}

interface Candidate {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  petNames: string[];
  match: "phone" | "email" | "name" | null;
}

interface Preview {
  target: { id: string; name: string; phone: string };
  source: { id: string; name: string; phone: string; email: string | null };
  counts: MergeCounts;
  total: number;
}

const MATCH_LABEL: Record<NonNullable<Candidate["match"]>, string> = {
  phone: "אותו טלפון",
  email: "אותו אימייל",
  name: "אותו שם",
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function MergeCustomerModal({ targetId, targetName, onClose, onMerged }: MergeCustomerModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim().slice(0, 100), 300);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const candidatesQuery = useQuery({
    queryKey: ["customer-merge-candidates", targetId, q],
    queryFn: () =>
      fetchJSON<{ candidates: Candidate[] }>(
        `/api/customers/${encodeURIComponent(targetId)}/merge/candidates?q=${encodeURIComponent(q)}`,
      ),
    enabled: !selected,
    staleTime: 15_000,
  });

  const previewQuery = useQuery({
    queryKey: ["customer-merge-preview", targetId, selected?.id],
    queryFn: () =>
      fetchJSON<Preview>(
        `/api/customers/${encodeURIComponent(targetId)}/merge?sourceId=${encodeURIComponent(selected!.id)}`,
      ),
    enabled: !!selected,
    staleTime: 0,
    gcTime: 0,
  });

  const mergeMutation = useMutation({
    mutationFn: async (sourceId: string) =>
      fetchJSON<{ ok: true; moved: MergeCounts }>(`/api/customers/${encodeURIComponent(targetId)}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, confirm: mergeConfirmToken(sourceId) }),
      }),
    onSuccess: () => {
      toast.success("הלקוחות מוזגו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["customer", targetId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (selected) queryClient.removeQueries({ queryKey: ["customer", selected.id] });
      onMerged();
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במיזוג הלקוחות"),
  });

  const sourceName = previewQuery.data?.source.name ?? selected?.name ?? "";
  const confirmOk = typed.trim() !== "" && typed.trim() === sourceName.trim();
  const movingRows = previewQuery.data
    ? MERGE_RELATIONS.filter((r) => (previewQuery.data!.counts[r.key] ?? 0) > 0)
    : [];

  const backToSearch = () => {
    setSelected(null);
    setTyped("");
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !mergeMutation.isPending) onClose(); }}>
      <div
        className="modal-content w-full max-w-lg mx-4 p-0 max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-customer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            {selected && (
              <button
                type="button"
                onClick={backToSearch}
                disabled={mergeMutation.isPending}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="חזרה לבחירת לקוח"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <GitMerge className="w-5 h-5 text-brand-500 shrink-0" />
            <h2 id="merge-customer-title" className="text-lg font-bold text-petra-text truncate">
              מיזוג לקוח כפול
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mergeMutation.isPending}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">
          {!selected ? (
            /* ── Step 1: pick the duplicate ── */
            <div className="space-y-3">
              <p className="text-sm text-petra-muted">
                בחר את הלקוח הכפול שיתמזג לתוך <span className="font-semibold text-petra-text">{targetName}</span>.
              </p>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
                <input
                  className="input pr-9 w-full"
                  placeholder="חיפוש לפי שם, טלפון או אימייל"
                  value={search}
                  maxLength={100}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {!q && (
                <p className="text-xs text-petra-muted">הצעות: לקוחות עם אותו טלפון / אימייל / שם מופיעים ראשונים.</p>
              )}

              {candidatesQuery.isLoading ? (
                <PetraLoader variant="inline" className="py-6" />
              ) : candidatesQuery.isError ? (
                <p className="text-sm text-red-600 py-4 text-center">
                  {(candidatesQuery.error as Error)?.message || "שגיאה בטעינת לקוחות"}
                </p>
              ) : (candidatesQuery.data?.candidates ?? []).length === 0 ? (
                <p className="text-sm text-petra-muted py-6 text-center">לא נמצאו לקוחות מתאימים</p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {candidatesQuery.data!.candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => { setSelected(c); setTyped(""); }}
                        className="w-full text-right px-3 py-3 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-petra-text truncate">{c.name}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-petra-muted mt-0.5">
                            <span className="inline-flex items-center gap-1" dir="ltr">
                              <Phone className="w-3 h-3" />{c.phone}
                            </span>
                            {c.petNames.length > 0 && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <PawPrint className="w-3 h-3" />{c.petNames.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.match && (
                          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {MATCH_LABEL[c.match]}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* ── Step 2: preview + typed confirmation ── */
            <div className="space-y-4">
              {previewQuery.isLoading ? (
                <PetraLoader variant="inline" className="py-8" />
              ) : previewQuery.isError ? (
                <div className="text-sm text-red-600 py-4 text-center space-y-3">
                  <p>{(previewQuery.error as Error)?.message || "שגיאה בטעינת תצוגת המיזוג"}</p>
                  <button type="button" className="btn-secondary" onClick={backToSearch}>חזרה</button>
                </div>
              ) : previewQuery.data ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900 space-y-1">
                      <p>
                        הלקוח <span className="font-bold">{previewQuery.data.source.name}</span> יימחק וכל הנתונים שלו
                        יועברו ל<span className="font-bold">{previewQuery.data.target.name}</span>.
                      </p>
                      <p className="text-xs text-amber-800">
                        הפרטים של {previewQuery.data.target.name} נשמרים; שדות ריקים יושלמו מהלקוח הכפול, תגיות ומסמכים
                        יאוחדו והערות יצורפו. לא ניתן לבטל פעולה זו.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 min-w-0">
                      <div className="text-xs text-red-600 font-medium mb-1">יימחק</div>
                      <div className="font-semibold text-petra-text truncate">{previewQuery.data.source.name}</div>
                      <div className="text-xs text-petra-muted truncate" dir="ltr">{previewQuery.data.source.phone}</div>
                      {previewQuery.data.source.email && (
                        <div className="text-xs text-petra-muted truncate" dir="ltr">{previewQuery.data.source.email}</div>
                      )}
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 min-w-0">
                      <div className="text-xs text-emerald-700 font-medium mb-1">נשאר</div>
                      <div className="font-semibold text-petra-text truncate">{previewQuery.data.target.name}</div>
                      <div className="text-xs text-petra-muted truncate" dir="ltr">{previewQuery.data.target.phone}</div>
                    </div>
                  </div>

                  <div>
                    <div className="label mb-1.5">מה יועבר</div>
                    {movingRows.length === 0 ? (
                      <p className="text-sm text-petra-muted">ללקוח הכפול אין נתונים מקושרים — רק פרטי הלקוח ימוזגו.</p>
                    ) : (
                      <ul className="grid grid-cols-2 gap-1.5">
                        {movingRows.map((r) => (
                          <li
                            key={r.key}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm"
                          >
                            <span className="text-petra-muted truncate">{r.label}</span>
                            <span className="font-semibold text-petra-text tabular-nums">
                              {previewQuery.data!.counts[r.key]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <label className="label" htmlFor="merge-confirm-input">
                      לאישור, הקלד את שם הלקוח שיימחק: <span className="font-bold">{previewQuery.data.source.name}</span>
                    </label>
                    <input
                      id="merge-confirm-input"
                      className="input w-full"
                      value={typed}
                      maxLength={120}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={previewQuery.data.source.name}
                      autoComplete="off"
                      disabled={mergeMutation.isPending}
                    />
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-start gap-2 px-5 py-4 border-t border-slate-100">
          {selected && previewQuery.data && (
            <button
              type="button"
              className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={!confirmOk || mergeMutation.isPending}
              onClick={() => mergeMutation.mutate(previewQuery.data!.source.id)}
            >
              <GitMerge className="w-4 h-4" />
              {mergeMutation.isPending ? "ממזג..." : "מזג לקוחות"}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={mergeMutation.isPending}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
