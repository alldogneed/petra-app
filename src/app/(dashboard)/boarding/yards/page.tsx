"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TreePine, Plus, Pencil, Trash2, Check, X, PawPrint } from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoomStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  pet: { id: string; name: string; breed: string | null; species: string };
  customer: { id: string; name: string; phone: string } | null;
}

interface Yard {
  id: string;
  name: string;
  capacity: number;
  type: string;
  status: string;
  isActive: boolean;
  pricePerSession: number | null;
  _count: { boardingStays: number };
  boardingStays: RoomStay[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const YARD_TYPE_LABELS: Record<string, string> = {
  standard: "רגילה",
  large: "גדולה",
  group: "קבוצתית",
};

const ROOM_STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:      { label: "פנוי",        color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
  occupied:       { label: "תפוס",        color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
  needs_cleaning: { label: "דרוש ניקיון", color: "#EAB308", bg: "#FEFCE8", border: "#FDE047" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function YardsPage() {
  const queryClient = useQueryClient();

  const [editingYardId, setEditingYardId] = useState<string | null>(null);
  const [editYardForm, setEditYardForm] = useState({ name: "", capacity: 1, type: "standard", pricePerSession: "" as string | number });
  const [newYardForm, setNewYardForm] = useState({ name: "", capacity: 1, type: "standard", pricePerSession: "" as string | number });
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: yards = [], isLoading } = useQuery<Yard[]>({
    queryKey: ["yards"],
    queryFn: () => fetchJSON<Yard[]>("/api/boarding/yards"),
  });

  const createYardMutation = useMutation({
    mutationFn: (data: { name: string; capacity: number; type: string; pricePerSession: string | number }) =>
      fetch("/api/boarding/yards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pricePerSession: data.pricePerSession !== "" ? Number(data.pricePerSession) : null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yards"] });
      setNewYardForm({ name: "", capacity: 1, type: "standard", pricePerSession: "" });
      setShowAddForm(false);
      toast.success("החצר נוצרה בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת החצר. נסה שוב."),
  });

  const updateYardMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; capacity: number; type: string; pricePerSession: string | number }) =>
      fetch(`/api/boarding/yards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, pricePerSession: data.pricePerSession !== "" ? Number(data.pricePerSession) : null }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yards"] });
      setEditingYardId(null);
      toast.success("החצר עודכנה בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון החצר. נסה שוב."),
  });

  const deleteYardMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/boarding/yards/${id}`, { method: "DELETE" })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקת החצר"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yards"] });
      toast.success("החצר נמחקה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת החצר. נסה שוב."),
  });

  function startEditYard(yard: Yard) {
    setEditingYardId(yard.id);
    setEditYardForm({ name: yard.name, capacity: yard.capacity, type: yard.type, pricePerSession: yard.pricePerSession ?? "" });
  }

  return (
    <div>
      <BoardingTabs />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-petra-text flex items-center gap-2">
            <TreePine className="w-5 h-5 text-teal-600" />
            ניהול חצרות
          </h1>
          <p className="text-sm text-petra-muted mt-0.5">הוסף, ערוך ונהל את החצרות שלך</p>
        </div>
        <button
          className="btn-primary !bg-teal-600 hover:!bg-teal-700 !border-teal-600"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <Plus className="w-4 h-4" />
          הוסף חצר
        </button>
      </div>

      {/* Add new yard form */}
      {showAddForm && (
        <div className="card p-5 mb-6 border-2 border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-petra-text flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />
              הוסף חצר חדשה
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">שם החצר *</label>
              <input
                className="input"
                placeholder='לדוגמה: חצר A, חצר גדולה...'
                value={newYardForm.name}
                onChange={(e) => setNewYardForm({ ...newYardForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">קיבולת</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={newYardForm.capacity}
                  onChange={(e) => setNewYardForm({ ...newYardForm, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="flex-1">
                <label className="label">סוג</label>
                <select
                  className="input"
                  value={newYardForm.type}
                  onChange={(e) => setNewYardForm({ ...newYardForm, type: e.target.value })}
                >
                  <option value="standard">רגילה</option>
                  <option value="large">גדולה</option>
                  <option value="group">קבוצתית</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="label">מחיר/שהייה (₪)</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  placeholder="אופציונלי"
                  value={newYardForm.pricePerSession}
                  onChange={(e) => setNewYardForm({ ...newYardForm, pricePerSession: e.target.value })}
                />
              </div>
            </div>
            <button
              className="btn-primary w-full !bg-teal-600 hover:!bg-teal-700 !border-teal-600"
              disabled={!newYardForm.name.trim() || createYardMutation.isPending}
              onClick={() => createYardMutation.mutate(newYardForm)}
            >
              <Plus className="w-4 h-4" />
              {createYardMutation.isPending ? "מוסיף..." : "הוסף חצר"}
            </button>
          </div>
        </div>
      )}

      {/* Yards grid */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-petra-muted">טוען חצרות...</p>
        </div>
      ) : yards.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <TreePine className="w-8 h-8 text-teal-400" />
          </div>
          <p className="text-sm font-medium text-petra-text mb-1">אין חצרות עדיין</p>
          <p className="text-xs text-petra-muted mb-4">לחץ על &quot;הוסף חצר&quot; כדי להתחיל</p>
          <button
            className="btn-primary !bg-teal-600 hover:!bg-teal-700 !border-teal-600 mx-auto"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4" />
            הוסף חצר ראשונה
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {yards.map((yard) => {
            const checkedIn = yard.boardingStays.filter((s) => s.status === "checked_in");
            const reserved = yard.boardingStays.filter((s) => s.status === "reserved");
            const isOccupied = checkedIn.length > 0;
            const needsCleaning = yard.status === "needs_cleaning";
            const displayStatus = isOccupied ? "occupied" : needsCleaning ? "needs_cleaning" : "available";
            const statusInfo = ROOM_STATUS_MAP[displayStatus];

            return (
              <div
                key={yard.id}
                className="card p-4 border-l-4"
                style={{ borderLeftColor: isOccupied ? "#14b8a6" : needsCleaning ? "#EAB308" : "#22C55E" }}
              >
                {editingYardId === yard.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <input
                      className="input"
                      placeholder="שם החצר"
                      value={editYardForm.name}
                      onChange={(e) => setEditYardForm({ ...editYardForm, name: e.target.value })}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="label text-[11px]">קיבולת</label>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={editYardForm.capacity}
                          onChange={(e) => setEditYardForm({ ...editYardForm, capacity: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="label text-[11px]">סוג</label>
                        <select
                          className="input"
                          value={editYardForm.type}
                          onChange={(e) => setEditYardForm({ ...editYardForm, type: e.target.value })}
                        >
                          <option value="standard">רגילה</option>
                          <option value="large">גדולה</option>
                          <option value="group">קבוצתית</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="label text-[11px]">מחיר/שהייה (₪)</label>
                        <input
                          type="number"
                          min={0}
                          className="input"
                          placeholder="אופציונלי"
                          value={editYardForm.pricePerSession}
                          onChange={(e) => setEditYardForm({ ...editYardForm, pricePerSession: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        className="btn-primary text-xs flex-1"
                        disabled={!editYardForm.name.trim() || updateYardMutation.isPending}
                        onClick={() => updateYardMutation.mutate({ id: yard.id, ...editYardForm })}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {updateYardMutation.isPending ? "שומר..." : "שמור"}
                      </button>
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => setEditingYardId(null)}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          <TreePine className="w-4 h-4 text-teal-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-petra-text leading-tight">{yard.name}</p>
                          <p className="text-[10px] text-petra-muted">{YARD_TYPE_LABELS[yard.type] || yard.type} · קיבולת {yard.capacity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted hover:text-petra-text transition-colors"
                          onClick={() => startEditYard(yard)}
                          title="ערוך"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => deleteYardMutation.mutate(yard.id)}
                          disabled={yard._count.boardingStays > 0 || deleteYardMutation.isPending}
                          title={yard._count.boardingStays > 0 ? "לא ניתן למחוק חצר עם שהיות פעילות" : "מחק חצר"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-2">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                        style={{ color: statusInfo.color, backgroundColor: statusInfo.bg, borderColor: statusInfo.border }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    {yard.boardingStays.length === 0 ? (
                      <p className="text-xs text-petra-muted text-center py-2">ריקה</p>
                    ) : (
                      <div className="space-y-1">
                        {checkedIn.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-teal-50 border border-teal-100">
                            <PawPrint className="w-3 h-3 text-teal-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-teal-800 truncate">{s.pet.name}</span>
                            {s.customer && <span className="text-[10px] text-teal-600 truncate mr-auto">{s.customer.name}</span>}
                          </div>
                        ))}
                        {reserved.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <PawPrint className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-600 truncate">{s.pet.name}</span>
                            <span className="text-[10px] text-slate-400 mr-auto">הזמנה</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {yard.pricePerSession != null && (
                      <p className="text-[10px] text-teal-600 mt-2">₪{yard.pricePerSession}/שהייה</p>
                    )}

                    <div className="mt-2 text-[10px] text-petra-muted">
                      {checkedIn.length}/{yard.capacity} כלבים כעת
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
