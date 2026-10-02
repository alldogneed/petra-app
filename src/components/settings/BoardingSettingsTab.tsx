"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Save, CheckCircle2, Hotel, Clock, Moon } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import { Business } from "./shared";

// ─── Boarding Settings Tab ───────────────────────────────────────────────────

export function BoardingSettingsTab() {
  const queryClient = useQueryClient();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [form, setForm] = useState<Partial<Business> | null>(null);
  const [saved, setSaved] = useState(false);

  const rawEditing = form ?? biz;
  const editing = rawEditing ? {
    ...rawEditing,
    boardingCheckInTime: rawEditing.boardingCheckInTime ?? "14:00",
    boardingCheckOutTime: rawEditing.boardingCheckOutTime ?? "11:00",
    boardingCalcMode: rawEditing.boardingCalcMode ?? "nights",
  } : rawEditing;

  const mutation = useMutation({
    mutationFn: (data: Partial<Business>) =>
      fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("הגדרות הפנסיון נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת ההגדרות"),
  });

  if (isLoading) return <PetraLoader />;
  if (!editing) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <Hotel className="w-4 h-4 text-brand-500" />
        <h2 className="text-base font-semibold text-petra-text">הגדרות פנסיון</h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              שעת צ׳ק-אין
            </label>
            <input type="time" className="input" value={editing.boardingCheckInTime ?? "14:00"} onChange={(e) => setForm({ ...editing, boardingCheckInTime: e.target.value })} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              שעת צ׳ק-אאוט
            </label>
            <input type="time" className="input" value={editing.boardingCheckOutTime ?? "11:00"} onChange={(e) => setForm({ ...editing, boardingCheckOutTime: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5" />
              חישוב לפי
            </label>
            <select className="input" value={editing.boardingCalcMode ?? "nights"} onChange={(e) => setForm({ ...editing, boardingCalcMode: e.target.value })}>
              <option value="nights">לילות</option>
              <option value="days">ימים</option>
            </select>
          </div>
          <div>
            <label className="label">מינימום לילות</label>
            <input type="number" min={0} className="input" value={editing.boardingMinNights ?? 1} onChange={(e) => setForm({ ...editing, boardingMinNights: Number(e.target.value) })} />
          </div>
        </div>
      </div>
      <button
        className={cn("btn-primary flex items-center gap-2 transition-all", saved && "bg-emerald-500 hover:brightness-100")}
        style={saved ? { background: "#10B981" } : undefined}
        disabled={mutation.isPending || !form}
        onClick={() => { if (form) mutation.mutate(form); }}
      >
        {saved ? <><CheckCircle2 className="w-4 h-4" /> נשמר!</> : <><Save className="w-4 h-4" /> שמור שינויים</>}
      </button>
    </div>
  );
}
