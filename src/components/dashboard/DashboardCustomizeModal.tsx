"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, X, RotateCcw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn, fetchJSON } from "@/lib/utils";
import {
  DASHBOARD_BLOCKS,
  DASHBOARD_PREFS_QUERY_KEY,
  DASHBOARD_STATS,
  isAllowed,
  resolveBlockOrder,
  type DashboardBlockId,
  type DashboardPrefs,
  type DashboardPrefsResponse,
  type DashboardWidgetId,
  type RequirementFlags,
} from "@/lib/dashboard-widgets";

const BLOCK_BY_ID = new Map(DASHBOARD_BLOCKS.map((b) => [b.id, b]));

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative w-10 h-6 rounded-full transition-colors flex-shrink-0",
        on ? "bg-brand-500" : "bg-slate-200"
      )}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ insetInlineStart: on ? "1.25rem" : "0.25rem" }}
      />
    </button>
  );
}

export function DashboardCustomizeModal({
  prefs,
  flags,
  onClose,
}: {
  prefs: DashboardPrefs;
  flags: RequirementFlags;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<DashboardBlockId[]>(() => resolveBlockOrder(prefs.order));
  const [hidden, setHidden] = useState<Set<DashboardWidgetId>>(() => new Set(prefs.hidden));

  const allowedBlocks = order.filter((id) => isAllowed(BLOCK_BY_ID.get(id)!, flags));
  const allowedStats = DASHBOARD_STATS.filter((s) => isAllowed(s, flags));

  const save = useMutation({
    mutationFn: (body: { prefs: { hidden: string[]; order: string[] } | null }) =>
      fetchJSON<DashboardPrefsResponse>("/api/dashboard/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data, body) => {
      queryClient.setQueryData(DASHBOARD_PREFS_QUERY_KEY, data);
      toast.success(body.prefs === null ? "הדשבורד חזר לברירת המחדל" : "התצוגה נשמרה");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשמירת התצוגה"),
  });

  const toggle = (id: DashboardWidgetId) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Move among the blocks this member can see; blocks they can't see keep their slots.
  const move = (id: DashboardBlockId, dir: -1 | 1) => {
    const pos = allowedBlocks.indexOf(id);
    const swapWith = allowedBlocks[pos + dir];
    if (!swapWith) return;
    setOrder((prev) => {
      const next = [...prev];
      const a = next.indexOf(id);
      const b = next.indexOf(swapWith);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const visibleCount = allowedBlocks.filter((id) => !hidden.has(id)).length;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-customize-title"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex flex-col gap-0.5">
            <h2 id="dashboard-customize-title" className="m-0 text-lg font-bold text-slate-900">התאמת הדשבורד</h2>
            <p className="m-0 text-xs text-slate-500">
              בחרו מה יוצג ובאיזה סדר. ההגדרה אישית — רק לכם, בכל מכשיר.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex-shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center"
            aria-label="סגור"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              אזורים <span className="text-slate-500 font-normal">({visibleCount} מוצגים)</span>
            </h3>
            <ul className="space-y-1.5">
              {allowedBlocks.map((id, i) => {
                const def = BLOCK_BY_ID.get(id)!;
                const shown = !hidden.has(id);
                return (
                  <li
                    key={id}
                    className={cn(
                      "flex items-center gap-2.5 py-2 ps-2.5 pe-3 rounded-xl border transition-colors",
                      shown ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                    )}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(id, -1)}
                        disabled={i === 0}
                        className="w-[22px] h-[18px] flex items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30"
                        aria-label={`הזז למעלה: ${def.label}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(id, 1)}
                        disabled={i === allowedBlocks.length - 1}
                        className="w-[22px] h-[18px] flex items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30"
                        aria-label={`הזז למטה: ${def.label}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium truncate", shown ? "text-slate-900" : "text-slate-500")}>
                        {def.label}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{def.hint}</div>
                    </div>
                    <Toggle on={shown} onClick={() => toggle(id)} label={`הצג ${def.label}`} />
                  </li>
                );
              })}
            </ul>
          </section>

          {allowedStats.length > 0 && !hidden.has("stats") && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">כרטיסי מספרים</h3>
              <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-1.5">
                {allowedStats.map((s) => {
                  const shown = !hidden.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={shown}
                      className={cn(
                        "flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm text-right transition-colors",
                        shown
                          ? "border-orange-200 bg-orange-50/50 text-slate-900"
                          : "border-slate-100 bg-slate-50 text-slate-500"
                      )}
                    >
                      {shown ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-slate-100">
          <button
            className="h-[38px] px-[18px] rounded-xl bg-gradient-brand text-white text-sm font-semibold hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60"
            disabled={save.isPending}
            onClick={() => save.mutate({ prefs: { hidden: Array.from(hidden), order } })}
          >
            {save.isPending ? "שומר..." : "שמור"}
          </button>
          <button
            className="h-[38px] px-4 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium hover:bg-slate-50 hover:border-slate-300"
            onClick={onClose}
            disabled={save.isPending}
          >
            ביטול
          </button>
          <button
            type="button"
            className="ms-auto text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            disabled={save.isPending}
            onClick={() => save.mutate({ prefs: null })}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            חזרה לברירת מחדל
          </button>
        </div>
      </div>
    </div>
  );
}
