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
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-customize-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 id="dashboard-customize-title" className="text-lg font-bold text-petra-text">התאמת הדשבורד</h2>
            <p className="text-xs text-petra-muted mt-0.5">
              בחרו מה יוצג ובאיזה סדר. ההגדרה אישית — רק לכם, בכל מכשיר.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-petra-text mb-2">
              אזורים <span className="text-petra-muted font-normal">({visibleCount} מוצגים)</span>
            </h3>
            <ul className="space-y-1.5">
              {allowedBlocks.map((id, i) => {
                const def = BLOCK_BY_ID.get(id)!;
                const shown = !hidden.has(id);
                return (
                  <li
                    key={id}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-xl border transition-colors",
                      shown ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
                    )}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(id, -1)}
                        disabled={i === 0}
                        className="p-0.5 text-slate-400 hover:text-petra-text disabled:opacity-30"
                        aria-label={`הזז למעלה: ${def.label}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(id, 1)}
                        disabled={i === allowedBlocks.length - 1}
                        className="p-0.5 text-slate-400 hover:text-petra-text disabled:opacity-30"
                        aria-label={`הזז למטה: ${def.label}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium truncate", shown ? "text-petra-text" : "text-petra-muted")}>
                        {def.label}
                      </div>
                      <div className="text-[11px] text-petra-muted truncate">{def.hint}</div>
                    </div>
                    <Toggle on={shown} onClick={() => toggle(id)} label={`הצג ${def.label}`} />
                  </li>
                );
              })}
            </ul>
          </section>

          {allowedStats.length > 0 && !hidden.has("stats") && (
            <section>
              <h3 className="text-sm font-semibold text-petra-text mb-2">כרטיסי מספרים</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {allowedStats.map((s) => {
                  const shown = !hidden.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={shown}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border text-sm text-right transition-colors",
                        shown
                          ? "border-brand-200 bg-brand-50/50 text-petra-text"
                          : "border-slate-100 bg-slate-50 text-petra-muted"
                      )}
                    >
                      {shown ? <Eye className="w-4 h-4 text-brand-500" /> : <EyeOff className="w-4 h-4" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 p-5 border-t border-slate-100">
          <button
            className="btn-primary"
            disabled={save.isPending}
            onClick={() => save.mutate({ prefs: { hidden: Array.from(hidden), order } })}
          >
            {save.isPending ? "שומר..." : "שמור"}
          </button>
          <button className="btn-secondary" onClick={onClose} disabled={save.isPending}>
            ביטול
          </button>
          <button
            type="button"
            className="ms-auto text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
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
