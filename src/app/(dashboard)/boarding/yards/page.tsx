"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Fence, Plus, Pencil, Trash2, Check, X, PawPrint, Search, GripVertical, Printer, Calendar, Share2, LayoutGrid } from "lucide-react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { cn, fetchJSON } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StayPet {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  serviceDogProfile: { id: string } | null;
}

interface ActiveStay {
  id: string;
  status: "reserved" | "checked_in";
  pet: StayPet;
  customer: { id: string; name: string; phone: string } | null;
  room: { id: string; name: string } | null;
  yard: { id: string; name: string } | null;
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
  boardingStays: ActiveStay[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const YARD_TYPE_LABELS: Record<string, string> = {
  standard: "רגילה",
  large: "גדולה",
  group: "קבוצתית",
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:      { label: "פנוי",        color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
  occupied:       { label: "תפוס",        color: "#14B8A6", bg: "#F0FDFA", border: "#99F6E4" },
  needs_cleaning: { label: "דרוש ניקיון", color: "#EAB308", bg: "#FEFCE8", border: "#FDE047" },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Draggable stay card (panel) ──────────────────────────────────────────────

function DraggableStayCard({ stay }: { stay: ActiveStay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: stay.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing select-none touch-none",
        isDragging
          ? "opacity-0"
          : "bg-white border-slate-200 text-petra-text hover:border-brand-300 hover:shadow-sm"
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
      <PawPrint className="w-3.5 h-3.5 flex-shrink-0 text-brand-400" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{stay.pet.name}</p>
        <p className="text-[10px] text-petra-muted truncate">
          {stay.customer?.name ?? "כלב שירות"}
          {stay.room && <span className="text-slate-400"> · {stay.room.name}</span>}
        </p>
      </div>
      {stay.status === "reserved" && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
          הזמנה
        </span>
      )}
    </div>
  );
}

// ─── Draggable occupant card (inside yard) ────────────────────────────────────

function DraggableOccupantCard({ stay, onRemove }: { stay: ActiveStay; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: stay.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "p-2 rounded-lg group cursor-grab active:cursor-grabbing select-none touch-none",
        isDragging ? "opacity-0" : ""
      )}
      style={{ background: "#F0FDFA", border: "1px solid #99F6E4" }}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <GripVertical className="w-2.5 h-2.5 text-teal-400 flex-shrink-0" />
        <PawPrint className="w-3 h-3 text-teal-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-teal-900 truncate flex-1">{stay.pet.name}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="no-print opacity-0 group-hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center rounded text-red-400 hover:text-red-600 transition-all flex-shrink-0"
          title="הסר מהחצר"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
      <div className="text-[10px] text-teal-700 truncate">{stay.customer?.name ?? "כלב שירות"}</div>
      {stay.room && <div className="text-[10px] text-teal-600/70 truncate">{stay.room.name}</div>}
    </div>
  );
}

// ─── Droppable yard card ──────────────────────────────────────────────────────

function DroppableYardCard({
  yard,
  occupants,
  onEdit,
  onDelete,
  onRemoveDog,
  isDeleting,
}: {
  yard: Yard;
  occupants: ActiveStay[];
  onEdit: () => void;
  onDelete: () => void;
  onRemoveDog: (stayId: string) => void;
  isDeleting: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: yard.id });

  const checkedIn = occupants.filter((s) => s.status === "checked_in");
  const isFull    = occupants.length >= yard.capacity;
  const displayStatus =
    checkedIn.length > 0 ? "occupied" :
    yard.status === "needs_cleaning" ? "needs_cleaning" : "available";
  const statusInfo = STATUS_MAP[displayStatus];
  const barColor = checkedIn.length > 0 ? statusInfo.color : yard.status === "needs_cleaning" ? "#EAB308" : "#22C55E";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "card overflow-hidden transition-all",
        isOver && !isFull ? "ring-2 ring-teal-400 shadow-lg scale-[1.02]" : "hover:shadow-md",
        isOver && isFull && "ring-2 ring-red-300"
      )}
    >
      {/* Color bar — matches room card style */}
      <div className="h-1.5" style={{ backgroundColor: barColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Fence className="w-5 h-5" style={{ color: barColor }} />
            <span className="font-bold text-petra-text">{yard.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ background: statusInfo.bg, color: statusInfo.color, borderColor: statusInfo.border }}
            >
              {statusInfo.label}
            </span>
            <button
              className="no-print w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted hover:text-petra-text transition-colors"
              onClick={onEdit} title="ערוך"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              className="no-print w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors disabled:opacity-40"
              onClick={onDelete}
              disabled={yard._count.boardingStays > 0 || isDeleting}
              title={yard._count.boardingStays > 0 ? "לא ניתן למחוק חצר עם שהיות פעילות" : "מחק"}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-petra-muted mb-3">
          <span>{occupants.length}/{yard.capacity}</span>
          <span className="badge-neutral text-[10px]">{YARD_TYPE_LABELS[yard.type] || yard.type}</span>
          {yard.pricePerSession != null && (
            <span className="ms-auto text-[10px] font-semibold text-teal-600">₪{yard.pricePerSession}/שהייה</span>
          )}
          {isFull && <span className="ms-auto text-[10px] font-semibold text-red-500">מלאה</span>}
        </div>

        {/* Dogs — 2-column grid like rooms */}
        {occupants.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {occupants.map((s) => (
              <DraggableOccupantCard
                key={s.id}
                stay={s}
                onRemove={() => onRemoveDog(s.id)}
              />
            ))}
            {isOver && !isFull && (
              <div className="p-2 rounded-lg border-2 border-dashed border-teal-300 bg-teal-50/50 flex items-center justify-center">
                <span className="text-[10px] text-teal-500">שחרר כאן</span>
              </div>
            )}
          </div>
        ) : (
          <div className={cn(
            "flex flex-col items-center justify-center py-5 rounded-lg border-2 border-dashed transition-colors",
            isOver ? "border-teal-400 bg-teal-50/50" : "border-slate-200"
          )}>
            <Fence className="w-4 h-4 text-slate-300 mb-1" />
            <p className="text-[10px] text-slate-400">{isOver ? "שחרר כאן להוספה" : "גרור כלב לכאן"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function YardsPage() {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [editingYardId, setEditingYardId] = useState<string | null>(null);
  const [editYardForm, setEditYardForm] = useState({ name: "", capacity: 1, type: "standard", pricePerSession: "" as string | number });
  const [newYardForm, setNewYardForm] = useState({ name: "", capacity: 1, type: "standard", pricePerSession: "" as string | number });
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Date range — defaults to today
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

  // ── Data ──
  const { data: yards = [], isLoading: yardsLoading } = useQuery<Yard[]>({
    queryKey: ["yards"],
    queryFn: () => fetchJSON<Yard[]>("/api/boarding/yards"),
  });

  // Fetch boarding stays for selected date range (reserved + checked_in)
  const { data: allStays = [] } = useQuery<ActiveStay[]>({
    queryKey: ["boarding-all-stays", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/boarding?from=${fromDate}&to=${toDate}`)
        .then((r) => r.json()),
    select: (data: ActiveStay[]) =>
      data.filter((s) => s.status === "reserved" || s.status === "checked_in"),
  });

  // ── Computed ──
  // Build a map of stayId → yard from the yards data
  const yardStayMap = useMemo(() => {
    const map = new Map<string, string>(); // stayId → yardId
    yards.forEach((y) => y.boardingStays.forEach((s) => map.set(s.id, y.id)));
    return map;
  }, [yards]);

  // Panel: stays for the selected date range that have no yard
  const filteredStays = useMemo(() => {
    const base = allStays.filter((s) => !yardStayMap.has(s.id));
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((s) =>
      s.pet.name.toLowerCase().includes(q) ||
      s.customer?.name.toLowerCase().includes(q)
    );
  }, [allStays, yardStayMap, search]);

  const unassignedStays = filteredStays;

  // For the drag overlay: search both panel stays and all yard occupants
  const allKnownStays = useMemo(() => {
    const map = new Map<string, ActiveStay>();
    allStays.forEach((s) => map.set(s.id, s));
    yards.forEach((y) =>
      y.boardingStays.forEach((s) => {
        if (!map.has(s.id)) map.set(s.id, s as unknown as ActiveStay);
      })
    );
    return map;
  }, [allStays, yards]);

  const draggedStay = activeId ? allKnownStays.get(activeId) ?? null : null;

  // ── Mutations ──
  const assignYardMutation = useMutation({
    mutationFn: ({ stayId, yardId }: { stayId: string; yardId: string | null }) =>
      fetch(`/api/boarding/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yardId }),
      }).then((r) => { if (!r.ok) throw new Error("שגיאה"); return r.json(); }),
    onMutate: async ({ stayId, yardId }) => {
      const yardsKey = ["yards"];
      const staysKey = ["boarding-all-stays", fromDate, toDate];

      await queryClient.cancelQueries({ queryKey: yardsKey });
      await queryClient.cancelQueries({ queryKey: staysKey });

      const prevYards = queryClient.getQueryData<Yard[]>(yardsKey);
      const prevStays = queryClient.getQueryData<ActiveStay[]>(staysKey);

      // Find the stay in any of our caches
      const stay =
        prevStays?.find((s) => s.id === stayId) ??
        prevYards?.flatMap((y) => y.boardingStays).find((s) => s.id === stayId) ??
        null;

      const targetYard = yardId ? (prevYards?.find((y) => y.id === yardId) ?? null) : null;

      // Optimistically update yards cache (source of truth for yard card display)
      queryClient.setQueryData<Yard[]>(yardsKey, (old) => {
        if (!old) return old;
        return old.map((y) => {
          const withoutStay = y.boardingStays.filter((s) => s.id !== stayId);
          if (yardId && y.id === yardId && stay) {
            // Add to target yard
            return { ...y, boardingStays: [...withoutStay, { ...stay, yard: { id: y.id, name: y.name } }] };
          }
          return { ...y, boardingStays: withoutStay };
        });
      });

      // Optimistically update stays cache (keeps panel in sync)
      queryClient.setQueryData<ActiveStay[]>(staysKey, (old) => {
        if (!old) return old;
        return old.map((s) =>
          s.id !== stayId ? s : { ...s, yard: targetYard ? { id: targetYard.id, name: targetYard.name } : null }
        );
      });

      return { prevYards, prevStays };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevYards) queryClient.setQueryData(["yards"], ctx.prevYards);
      if (ctx?.prevStays) queryClient.setQueryData(["boarding-all-stays", fromDate, toDate], ctx.prevStays);
      toast.error("שגיאה בשיבוץ הכלב");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["yards"] });
      queryClient.invalidateQueries({ queryKey: ["boarding-all-stays"] });
    },
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
    onError: () => toast.error("שגיאה ביצירת החצר"),
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
      toast.success("החצר עודכנה");
    },
    onError: () => toast.error("שגיאה בעדכון החצר"),
  });

  const deleteYardMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/boarding/yards/${id}`, { method: "DELETE" })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yards"] });
      toast.success("החצר נמחקה");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה במחיקת החצר"),
  });

  function startEditYard(yard: Yard) {
    setEditingYardId(yard.id);
    setEditYardForm({ name: yard.name, capacity: yard.capacity, type: yard.type, pricePerSession: yard.pricePerSession ?? "" });
  }

  // ── DnD ──
  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const stayId = String(active.id);
    const targetYardId = String(over.id);

    // Dropped on a yard card
    const targetYard = yards.find((y) => y.id === targetYardId);
    if (!targetYard) return;

    const currentYardId = yardStayMap.get(stayId) ?? null;
    if (currentYardId === targetYardId) return; // no change

    // Check capacity (count stays already in target yard)
    const occupants = yards.find((y) => y.id === targetYardId)?.boardingStays ?? [];
    if (occupants.length >= targetYard.capacity) {
      toast.error(`החצר ${targetYard.name} מלאה (קיבולת ${targetYard.capacity})`);
      return;
    }

    assignYardMutation.mutate({ stayId, yardId: targetYardId });
  }

  return (
    <div>
      <BoardingTabs />

      {/* Page header — matches boarding rooms style */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="page-title">ניהול חצרות</h1>
        <p className="text-sm text-petra-muted">
          {yards.length} חצרות · {yards.reduce((n, y) => n + y.boardingStays.length, 0)} כלבים בחצרות
        </p>
        <div className="flex gap-2 ms-auto flex-wrap">
          {/* סבב חצרות — WhatsApp share, only when dogs are assigned */}
          {yards.some((y) => y.boardingStays.length > 0) && (() => {
            const todayStr3 = new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
            const lines = [`🌿 סבב חצרות — ${todayStr3}`, ""];
            for (const yard of yards) {
              if (yard.boardingStays.length === 0) continue;
              lines.push(`📍 *${yard.name}* (${yard.boardingStays.length}/${yard.capacity}):`);
              for (const s of yard.boardingStays) {
                lines.push(`  🐾 ${s.pet.name}${s.customer ? ` — ${s.customer.name}` : ""}`);
              }
              lines.push("");
            }
            const waUrl = `https://wa.me/?text=${encodeURIComponent(lines.join("\n").trim())}`;
            return (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary hidden sm:flex no-print"
                title="שתף סבב חצרות"
              >
                <Share2 className="w-4 h-4" />
                סבב חצרות
              </a>
            );
          })()}
          <button
            className="btn-primary !bg-teal-600 hover:!bg-teal-700 !border-teal-600 no-print"
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus className="w-4 h-4" />
            הוסף חצר
          </button>
        </div>
      </div>

      {/* Date range strip — like boarding rooms */}
      <div className="flex items-center gap-2 mb-6 flex-wrap no-print">
        <Calendar className="w-3.5 h-3.5 text-petra-muted flex-shrink-0" />
        <input
          type="date"
          lang="he"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            if (e.target.value > toDate) setToDate(e.target.value);
          }}
          className="text-xs border border-petra-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 h-7 w-32"
        />
        <span className="text-xs text-petra-muted">—</span>
        <input
          type="date"
          lang="he"
          value={toDate}
          min={fromDate}
          onChange={(e) => setToDate(e.target.value)}
          className="text-xs border border-petra-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 h-7 w-32"
        />
        {unassignedStays.length > 0 && (
          <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
            {unassignedStays.length} ממתינים לשיבוץ
          </span>
        )}
      </div>

      {/* View toggle bar — matches boarding rooms style */}
      <div className="flex items-center justify-between mb-4 no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-petra-muted hover:text-petra-text hover:bg-slate-100 transition-all border border-slate-200"
            title="הדפס מפת חצרות"
          >
            <Printer className="w-3.5 h-3.5" />הדפסה
          </button>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-white shadow-sm text-petra-text">
              <LayoutGrid className="w-3.5 h-3.5" />כרטיסים
            </button>
          </div>
        </div>
      </div>

      {/* Add yard form */}
      {showAddForm && (
        <div className="card p-5 mb-6 border-2 border-teal-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-petra-text flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" />הוסף חצר חדשה
            </h3>
            <button onClick={() => setShowAddForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">שם החצר *</label>
              <input
                className="input"
                placeholder='לדוגמה: חצר א׳, חצר גדולה...'
                value={newYardForm.name}
                onChange={(e) => setNewYardForm({ ...newYardForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label">קיבולת</label>
                <input type="number" min={1} className="input" value={newYardForm.capacity}
                  onChange={(e) => setNewYardForm({ ...newYardForm, capacity: Number(e.target.value) })} />
              </div>
              <div className="flex-1">
                <label className="label">סוג</label>
                <select className="input" value={newYardForm.type}
                  onChange={(e) => setNewYardForm({ ...newYardForm, type: e.target.value })}>
                  <option value="standard">רגילה</option>
                  <option value="large">גדולה</option>
                  <option value="group">קבוצתית</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="label">מחיר/שהייה (₪)</label>
                <input type="number" min={0} className="input" placeholder="אופציונלי"
                  value={newYardForm.pricePerSession}
                  onChange={(e) => setNewYardForm({ ...newYardForm, pricePerSession: e.target.value })} />
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

      {yardsLoading ? (
        <div className="card p-8 text-center text-sm text-petra-muted">טוען חצרות...</div>
      ) : yards.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
            <Fence className="w-8 h-8 text-teal-400" />
          </div>
          <p className="text-sm font-medium text-petra-text mb-1">אין חצרות עדיין</p>
          <p className="text-xs text-petra-muted mb-4">לחץ על &quot;הוסף חצר&quot; כדי להתחיל</p>
          <button className="btn-primary !bg-teal-600 hover:!bg-teal-700 !border-teal-600 mx-auto" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4" />הוסף חצר ראשונה
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-6">
            {/* Left: Dog panel */}
            <div className="w-52 flex-shrink-0 no-print">
              <div className="card p-3 sticky top-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <PawPrint className="w-4 h-4 text-brand-500" />
                  <h2 className="text-sm font-bold text-petra-text">ממתינים לחצר</h2>
                  <span className="ms-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600">{unassignedStays.length}</span>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted" />
                  <input
                    className="input pr-8 text-xs h-8"
                    placeholder="חיפוש..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Unassigned dogs */}
                {unassignedStays.length > 0 ? (
                  <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {unassignedStays.map((s) => (
                      <DraggableStayCard key={s.id} stay={s} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center text-petra-muted py-6">
                    {allStays.length > 0 ? "כל הכלבים שובצו ✓" : "אין כלבים בתאריכים אלו"}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Yards grid */}
            <div className="flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {yards.map((yard) => {
                  if (editingYardId === yard.id) {
                    return (
                      <div key={yard.id} className="card p-4 border-2 border-teal-200 space-y-2">
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
                            <input type="number" min={1} className="input" value={editYardForm.capacity}
                              onChange={(e) => setEditYardForm({ ...editYardForm, capacity: Number(e.target.value) })} />
                          </div>
                          <div className="flex-1">
                            <label className="label text-[11px]">סוג</label>
                            <select className="input" value={editYardForm.type}
                              onChange={(e) => setEditYardForm({ ...editYardForm, type: e.target.value })}>
                              <option value="standard">רגילה</option>
                              <option value="large">גדולה</option>
                              <option value="group">קבוצתית</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="label text-[11px]">מחיר/שהייה (₪)</label>
                          <input type="number" min={0} className="input" placeholder="אופציונלי"
                            value={editYardForm.pricePerSession}
                            onChange={(e) => setEditYardForm({ ...editYardForm, pricePerSession: e.target.value })} />
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
                          <button className="btn-secondary text-xs" onClick={() => setEditingYardId(null)}>
                            ביטול
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <DroppableYardCard
                      key={yard.id}
                      yard={yard}
                      occupants={yard.boardingStays as unknown as ActiveStay[]}
                      onEdit={() => startEditYard(yard)}
                      onDelete={() => deleteYardMutation.mutate(yard.id)}
                      onRemoveDog={(stayId) => assignYardMutation.mutate({ stayId, yardId: null })}
                      isDeleting={deleteYardMutation.isPending}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {draggedStay ? (
              <div className="card p-2.5 w-[200px] rotate-2 shadow-modal cursor-grabbing bg-white border border-teal-300">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                    <PawPrint className="w-3.5 h-3.5 text-teal-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-petra-text">{draggedStay.pet.name}</div>
                    <div className="text-[10px] text-petra-muted">
                      {draggedStay.customer?.name ?? "כלב שירות"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .modal-overlay { display: none !important; }
          body > *:not(#__next) { display: none !important; }
          nav, header, aside, [data-sidebar], [data-sonner-toaster] { display: none !important; }
          .card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
