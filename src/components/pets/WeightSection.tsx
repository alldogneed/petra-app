"use client";

// Weight tracking card (PetWeightEntry list + mini chart) — shared by the pet
// profile and the service-dog file ("תיק כלב"). Moved out of pets/[id]/page.tsx.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface WeightEntry {
  id: string;
  weight: number;
  recordedAt: string;
  notes: string | null;
}

export function weightQueryKey(petId: string) {
  return ["weight", petId] as const;
}

// ─── Weight Chart (inline SVG) ────────────────────────────────────────────────

export function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  ).slice(-12);

  const weights = sorted.map((e) => e.weight);
  const minW = Math.min(...weights) * 0.95;
  const maxW = Math.max(...weights) * 1.05;
  const range = maxW - minW || 1;

  const W = 280;
  const H = 80;
  const PAD = 10;

  const points = sorted.map((e, i) => {
    const x = PAD + (i / (sorted.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((e.weight - minW) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const lastPoint = points[points.length - 1].split(",");

  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {sorted.map((_, i) => {
          const [x, y] = points[i].split(",");
          return (
            <circle
              key={i}
              cx={parseFloat(x)}
              cy={parseFloat(y)}
              r="3"
              fill="#6366f1"
            />
          );
        })}
        <circle
          cx={parseFloat(lastPoint[0])}
          cy={parseFloat(lastPoint[1])}
          r="4"
          fill="#6366f1"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-petra-muted mt-1">
        <span>{formatDate(new Date(sorted[0].recordedAt))}</span>
        <span className="font-medium text-brand-600">
          {sorted[sorted.length - 1].weight} ק&quot;ג
        </span>
        <span>{formatDate(new Date(sorted[sorted.length - 1].recordedAt))}</span>
      </div>
    </div>
  );
}

// ─── Weight History Section ───────────────────────────────────────────────────

interface WeightSectionProps {
  petId: string;
  /** Called after an entry was added / deleted (e.g. refresh the parent's pet.weight). */
  onChanged?: () => void;
  /** How many rows to show before "הצג הכל" (default 8). */
  initialRows?: number;
  className?: string;
}

const todayYmd = () => new Date().toISOString().split("T")[0];

export function WeightSection({ petId, onChanged, initialRows = 8, className }: WeightSectionProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ weight: "", recordedAt: todayYmd(), notes: "" });

  const { data, isLoading } = useQuery<{ entries: WeightEntry[] }>({
    queryKey: weightQueryKey(petId),
    queryFn: () => fetch(`/api/pets/${petId}/weight`).then((r) => r.json()),
  });

  const entries = data?.entries ?? [];

  const addMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => {
        if (!r.ok) throw new Error("שגיאה");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weightQueryKey(petId) });
      setShowForm(false);
      setForm({ weight: "", recordedAt: todayYmd(), notes: "" });
      toast.success("מדידה נוספה");
      onChanged?.();
    },
    onError: () => toast.error("שגיאה בהוספת מדידה"),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) =>
      fetch(`/api/pets/${petId}/weight?entryId=${entryId}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("שגיאה");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weightQueryKey(petId) });
      setDeleteId(null);
      toast.success("מדידה נמחקה");
      onChanged?.();
    },
    onError: () => toast.error("שגיאה במחיקת מדידה"),
  });

  const visible = showAll ? entries : entries.slice(0, initialRows);

  return (
    <div className={cn("card p-5", className)}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          מעקב משקל
          {entries.length > 0 && (
            <span className="text-xs font-normal text-petra-muted">
              ({entries.length} מדידות)
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="btn-secondary text-xs flex items-center gap-1 py-1 px-2"
        >
          <Plus className="w-3 h-3" />
          הוסף מדידה
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">משקל (ק&quot;ג) *</label>
              <input
                className="input text-sm"
                type="number"
                step="0.1"
                min="0.1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="label text-xs">תאריך</label>
              <input
                className="input text-sm"
                type="date" lang="he"
                value={form.recordedAt}
                onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label text-xs">הערות (אופציונלי)</label>
            <input
              className="input text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="הערות על המשקל..."
            />
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-xs py-1.5 flex-1"
              disabled={!form.weight || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "שומר..." : "הוסף"}
            </button>
            <button className="btn-secondary text-xs py-1.5" onClick={() => setShowForm(false)}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <PetraLoader variant="inline" className="py-4" />
      ) : entries.length === 0 && !showForm ? (
        <p className="text-xs text-petra-muted text-center py-4">אין מדידות משקל עדיין</p>
      ) : (
        <>
          <WeightChart entries={entries} />
          {entries.length > 0 && (
            <div className="mt-3 divide-y divide-slate-50">
              {visible.map((entry) => (
                <div key={entry.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-petra-text">{entry.weight} ק&quot;ג</span>
                    <span className="text-xs text-petra-muted mr-2">
                      {formatDate(new Date(entry.recordedAt))}
                    </span>
                    {entry.notes && (
                      <p className="text-xs text-petra-muted truncate">{entry.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteId(entry.id)}
                    className="text-petra-muted hover:text-red-500 transition-colors p-1"
                    disabled={deleteMutation.isPending}
                    aria-label="מחק מדידה"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {entries.length > initialRows && (
            <button
              className="mt-2 text-xs text-brand-600 hover:underline"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? "הצג פחות" : `הצג הכל (${entries.length})`}
            </button>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="למחוק את המדידה?"
        description="המדידה תוסר מרשימת המשקל."
        confirmLabel="מחק"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
