"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Hotel,
  Plus,
  X,
  PawPrint,
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Check,
  Settings2,
  Search,
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  capacity: number;
  type: string;
  isActive: boolean;
  _count: { boardingStays: number };
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  notes: string | null;
  room: { id: string; name: string } | null;
  pet: { id: string; name: string; species: string };
  customer: { id: string; name: string };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string; species: string }[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  reserved:    { label: "הזמנה",  color: "#8B5CF6", bg: "#F5F3FF" },
  checked_in:  { label: "נמצא",   color: "#10B981", bg: "#ECFDF5" },
  checked_out: { label: "יצא",    color: "#64748B", bg: "#F1F5F9" },
  canceled:    { label: "בוטל",   color: "#EF4444", bg: "#FEF2F2" },
};

const ACTIVE_STATUSES = ["reserved", "checked_in"];
type TabKey = "active" | "checkin_today" | "checkout_today" | "history";

function toDateStr(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

// ─── Draggable Stay Card (used inside room columns) ──────────────────────────

function DraggableStayCard({
  stay,
  onCheckin,
  onCheckout,
}: {
  stay: BoardingStay;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: stay.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const today = toDateStr(new Date());
  const isCheckinToday = toDateStr(stay.checkIn) === today && stay.status === "reserved";
  const isCheckoutToday = stay.checkOut && toDateStr(stay.checkOut) === today && stay.status === "checked_in";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "card p-2.5 cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40 shadow-none"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: STATUS_MAP[stay.status]?.bg || "#F5F3FF" }}
        >
          <PawPrint className="w-3.5 h-3.5" style={{ color: STATUS_MAP[stay.status]?.color || "#8B5CF6" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-petra-text truncate">{stay.pet.name}</div>
          <div className="text-[10px] text-petra-muted truncate">{stay.customer.name}</div>
          <div className="text-[10px] text-petra-muted mt-0.5">
            {formatDate(stay.checkIn)}
            {stay.checkOut ? ` → ${formatDate(stay.checkOut)}` : ""}
          </div>
          {(isCheckinToday || isCheckoutToday) && (
            <div className="mt-1">
              {isCheckinToday && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-brand-50 text-brand-600 border border-brand-100">
                  <LogIn className="w-2.5 h-2.5" />צ׳ק-אין היום
                </span>
              )}
              {isCheckoutToday && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-50 text-red-600 border border-red-100">
                  <LogOut className="w-2.5 h-2.5" />צ׳ק-אאוט היום
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Action buttons — pointer events separate from drag */}
      <div
        className="flex gap-1 mt-2 pt-1.5 border-t border-slate-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {stay.status === "reserved" && (
          <button
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
            onClick={() => onCheckin(stay.id)}
          >
            <CheckCircle2 className="w-3 h-3" />צ׳ק-אין
          </button>
        )}
        {stay.status === "checked_in" && (
          <button
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => onCheckout(stay.id)}
          >
            <Clock className="w-3 h-3" />צ׳ק-אאוט
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Droppable Room Column ────────────────────────────────────────────────────

function RoomColumn({
  room,
  stays,
  onCheckin,
  onCheckout,
}: {
  room: { id: string; name: string; capacity: number; _count: { boardingStays: number } };
  stays: BoardingStay[];
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: room.id });
  const occupancy = room._count.boardingStays;
  const isFull = occupancy >= room.capacity;

  return (
    <div className="flex flex-col min-w-[200px] flex-1">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <DoorOpen className={cn("w-4 h-4 flex-shrink-0", isFull ? "text-red-400" : "text-brand-400")} />
        <span className="text-sm font-semibold text-petra-text truncate">{room.name}</span>
        <span
          className={cn(
            "mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            isFull
              ? "bg-red-50 text-red-600 border border-red-100"
              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
          )}
        >
          {occupancy}/{room.capacity}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[160px] rounded-xl p-2 space-y-2 transition-colors border",
          isOver
            ? "bg-brand-50/60 border-brand-200 border-dashed"
            : "bg-slate-50/80 border-slate-100"
        )}
      >
        {stays.length === 0 ? (
          <p className={cn("text-[11px] text-center py-6 transition-colors", isOver ? "text-brand-400" : "text-petra-muted")}>
            {isOver ? "שחרר כאן" : "אין שהיות"}
          </p>
        ) : (
          stays.map((stay) => (
            <DraggableStayCard
              key={stay.id}
              stay={stay}
              onCheckin={onCheckin}
              onCheckout={onCheckout}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Unassigned Drop Zone ─────────────────────────────────────────────────────

function UnassignedColumn({
  stays,
  onCheckin,
  onCheckout,
}: {
  stays: BoardingStay[];
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Hotel className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-petra-text">ללא חדר</span>
        <span className="mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {stays.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[60px] rounded-xl p-2 transition-colors border",
          stays.length === 0 && !isOver && "border-dashed",
          isOver
            ? "bg-brand-50/60 border-brand-200 border-dashed"
            : "bg-slate-50/50 border-slate-100"
        )}
      >
        {stays.length === 0 ? (
          <p className={cn("text-[11px] text-center py-3", isOver ? "text-brand-400" : "text-petra-muted")}>
            {isOver ? "שחרר להסרת חדר" : "גרור לכאן להסרת שיבוץ חדר"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stays.map((stay) => (
              <DraggableStayCard
                key={stay.id}
                stay={stay}
                onCheckin={onCheckin}
                onCheckout={onCheckout}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stay Row (for the list section) ─────────────────────────────────────────

function StayRow({
  stay,
  onCheckin,
  onCheckout,
}: {
  stay: BoardingStay;
  onCheckin: (id: string) => void;
  onCheckout: (id: string) => void;
}) {
  const st = STATUS_MAP[stay.status] || STATUS_MAP.reserved;
  const today = toDateStr(new Date());
  const isCheckinToday = toDateStr(stay.checkIn) === today && stay.status === "reserved";
  const isCheckoutToday = stay.checkOut && toDateStr(stay.checkOut) === today && stay.status === "checked_in";

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: st.bg }}>
        <PawPrint className="w-5 h-5" style={{ color: st.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-petra-text">{stay.pet.name}</span>
          <span className="text-sm text-petra-muted">—</span>
          <span className="text-sm text-petra-muted">{stay.customer.name}</span>
          {isCheckinToday && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-600 border border-brand-100">
              <LogIn className="w-2.5 h-2.5" />צ׳ק-אין היום
            </span>
          )}
          {isCheckoutToday && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
              <LogOut className="w-2.5 h-2.5" />צ׳ק-אאוט היום
            </span>
          )}
        </div>
        <div className="text-xs text-petra-muted flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(stay.checkIn).toLocaleDateString("he-IL")}
            {stay.checkOut ? ` → ${new Date(stay.checkOut).toLocaleDateString("he-IL")}` : " (פתוח)"}
          </span>
          {stay.room && (
            <span className="flex items-center gap-1">
              <DoorOpen className="w-3 h-3" />
              {stay.room.name}
            </span>
          )}
        </div>
      </div>

      <span className="badge text-[10px] flex-shrink-0" style={{ background: st.bg, color: st.color }}>
        {st.label}
      </span>

      {stay.status === "reserved" && (
        <button
          className="btn-ghost text-xs flex-shrink-0"
          onClick={() => onCheckin(stay.id)}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />צ׳ק-אין
        </button>
      )}
      {stay.status === "checked_in" && (
        <button
          className="btn-ghost text-xs flex-shrink-0"
          onClick={() => onCheckout(stay.id)}
        >
          <Clock className="w-3.5 h-3.5" />צ׳ק-אאוט
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BoardingPage() {
  const [showNewStay, setShowNewStay] = useState(false);
  const [form, setForm] = useState({
    customerId: "", petId: "", roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [activeStayId, setActiveStayId] = useState<string | null>(null);

  // Rooms manager
  const [showRoomsManager, setShowRoomsManager] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomForm, setEditRoomForm] = useState({ name: "", capacity: 1, type: "standard" });
  const [newRoomForm, setNewRoomForm] = useState({ name: "", capacity: 1, type: "standard" });

  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => fetchJSON<Room[]>("/api/boarding/rooms"),
  });

  const { data: stays = [], isLoading } = useQuery<BoardingStay[]>({
    queryKey: ["boarding"],
    queryFn: () => fetchJSON<BoardingStay[]>("/api/boarding"),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-select"],
    queryFn: () => fetchJSON<Customer[]>("/api/customers?full=1"),
    enabled: showNewStay,
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name.includes(customerSearch) ||
      c.phone.includes(customerSearch)
  );

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const checkInDT = data.checkIn ? `${data.checkIn}T${data.checkInTime || "12:00"}:00` : "";
      const checkOutDT = data.checkOut ? `${data.checkOut}T${data.checkOutTime || "12:00"}:00` : "";
      return fetch("/api/boarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: data.customerId,
          petId: data.petId,
          roomId: data.roomId || null,
          checkIn: checkInDT,
          checkOut: checkOutDT || null,
          notes: data.notes || null,
        }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowNewStay(false);
      setForm({ customerId: "", petId: "", roomId: "", checkIn: "", checkOut: "", checkInTime: "12:00", checkOutTime: "12:00", notes: "" });
      setCustomerSearch("");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const roomMutation = useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId: string | null }) =>
      fetch(`/api/boarding/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { name: string; capacity: number; type: string }) =>
      fetch("/api/boarding/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setNewRoomForm({ name: "", capacity: 1, type: "standard" });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; capacity: number; type: string }) =>
      fetch(`/api/boarding/rooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingRoomId(null);
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/boarding/rooms/${id}`, { method: "DELETE" })
        .then((r) => r.json())
        .then((data) => { if (data.error) throw new Error(data.error); return data; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  function startEditRoom(room: Room) {
    setEditingRoomId(room.id);
    setEditRoomForm({ name: room.name, capacity: room.capacity, type: room.type });
  }

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveStayId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveStayId(null);
    const { active, over } = event;
    if (!over) return;

    const stayId = String(active.id);
    const targetId = String(over.id);
    const stay = stays.find((s) => s.id === stayId);
    if (!stay) return;

    const newRoomId = targetId === "unassigned" ? null : targetId;
    const currentRoomId = stay.room?.id ?? null;
    if (newRoomId === currentRoomId) return;

    roomMutation.mutate({ id: stayId, roomId: newRoomId });
  }

  const handleCheckin = (id: string) => statusMutation.mutate({ id, status: "checked_in" });
  const handleCheckout = (id: string) => statusMutation.mutate({ id, status: "checked_out" });

  // Active stays for room view (reserved + checked_in only)
  const activeStays = stays.filter((s) => ACTIVE_STATUSES.includes(s.status));

  // Stays for list tabs
  const today = toDateStr(new Date());
  const tabStays: Record<TabKey, BoardingStay[]> = {
    active: [...activeStays].sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    checkin_today: activeStays.filter((s) => toDateStr(s.checkIn) === today && s.status === "reserved").sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    checkout_today: activeStays.filter((s) => s.checkOut && toDateStr(s.checkOut) === today && s.status === "checked_in").sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()),
    history: stays.filter((s) => !ACTIVE_STATUSES.includes(s.status)).sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()),
  };

  const checkinTodayCount = tabStays.checkin_today.length;
  const checkoutTodayCount = tabStays.checkout_today.length;

  const draggedStay = activeStayId ? stays.find((s) => s.id === activeStayId) : null;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "active", label: "הכל", count: activeStays.length },
    { key: "checkin_today", label: "צ׳ק-אין היום", count: checkinTodayCount },
    { key: "checkout_today", label: "צ׳ק-אאוט היום", count: checkoutTodayCount },
    { key: "history", label: "היסטוריה" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">פנסיון</h1>
          <p className="text-sm text-petra-muted mt-1">
            {activeStays.length} שהיות פעילות · {rooms.length} חדרים
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowRoomsManager(true)}>
            <Settings2 className="w-4 h-4" />ניהול חדרים
          </button>
          <button className="btn-primary" onClick={() => setShowNewStay(true)}>
            <Plus className="w-4 h-4" />שהייה חדשה
          </button>
        </div>
      </div>

      {/* ── Room View with DnD ── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-petra-text mb-3">מבט חדרים</h2>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Unassigned zone */}
          <UnassignedColumn
            stays={activeStays.filter((s) => !s.room)}
            onCheckin={handleCheckin}
            onCheckout={handleCheckout}
          />

          {/* Room columns */}
          {rooms.length === 0 ? (
            <div className="card p-6 text-center text-sm text-petra-muted">
              אין חדרים מוגדרים במערכת
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {rooms.map((room) => (
                <RoomColumn
                  key={room.id}
                  room={room}
                  stays={activeStays.filter((s) => s.room?.id === room.id)}
                  onCheckin={handleCheckin}
                  onCheckout={handleCheckout}
                />
              ))}
            </div>
          )}

          {/* Drag overlay — floating preview while dragging */}
          <DragOverlay>
            {draggedStay ? (
              <div className="card p-2.5 w-[200px] rotate-2 shadow-modal cursor-grabbing">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                    <PawPrint className="w-3.5 h-3.5 text-brand-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-petra-text">{draggedStay.pet.name}</div>
                    <div className="text-[10px] text-petra-muted">{draggedStay.customer.name}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Stays List with Tabs ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-petra-text">לוח שהיות</h2>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                activeTab === tab.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-petra-muted hover:bg-slate-100 hover:text-petra-text"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    activeTab === tab.key
                      ? "bg-white/20 text-white"
                      : tab.count > 0 && (tab.key === "checkin_today" || tab.key === "checkout_today")
                      ? "bg-red-100 text-red-600"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-20" />)}
          </div>
        ) : tabStays[activeTab].length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Hotel className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-petra-muted">
              {activeTab === "checkin_today" && "אין צ׳ק-אינים מתוכננים להיום"}
              {activeTab === "checkout_today" && "אין צ׳ק-אאוטים מתוכננים להיום"}
              {activeTab === "active" && "אין שהיות פעילות"}
              {activeTab === "history" && "אין שהיות בהיסטוריה"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tabStays[activeTab].map((stay) => (
              <StayRow
                key={stay.id}
                stay={stay}
                onCheckin={handleCheckin}
                onCheckout={handleCheckout}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Rooms Manager Modal ── */}
      {showRoomsManager && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => { setShowRoomsManager(false); setEditingRoomId(null); }} />
          <div className="modal-content max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-petra-text">ניהול חדרים</h2>
                <p className="text-sm text-petra-muted mt-0.5">הוסף, ערוך או מחק חדרים</p>
              </div>
              <button
                onClick={() => { setShowRoomsManager(false); setEditingRoomId(null); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing rooms list */}
            <div className="space-y-2 mb-6">
              {rooms.length === 0 ? (
                <p className="text-sm text-petra-muted text-center py-4">אין חדרים עדיין</p>
              ) : (
                rooms.map((room) => (
                  <div key={room.id} className="card p-3">
                    {editingRoomId === room.id ? (
                      /* ── Edit mode ── */
                      <div className="space-y-2">
                        <input
                          className="input"
                          placeholder="שם החדר"
                          value={editRoomForm.name}
                          onChange={(e) => setEditRoomForm({ ...editRoomForm, name: e.target.value })}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="label text-[11px]">קיבולת</label>
                            <input
                              type="number"
                              min={1}
                              className="input"
                              value={editRoomForm.capacity}
                              onChange={(e) => setEditRoomForm({ ...editRoomForm, capacity: Number(e.target.value) })}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="label text-[11px]">סוג</label>
                            <select
                              className="input"
                              value={editRoomForm.type}
                              onChange={(e) => setEditRoomForm({ ...editRoomForm, type: e.target.value })}
                            >
                              <option value="standard">רגיל</option>
                              <option value="premium">פרמיום</option>
                              <option value="suite">סוויט</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            className="btn-primary text-xs flex-1"
                            disabled={!editRoomForm.name.trim() || updateRoomMutation.isPending}
                            onClick={() => updateRoomMutation.mutate({ id: room.id, ...editRoomForm })}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {updateRoomMutation.isPending ? "שומר..." : "שמור"}
                          </button>
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => setEditingRoomId(null)}
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── View mode ── */
                      <div className="flex items-center gap-3">
                        <DoorOpen className="w-4 h-4 text-brand-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-petra-text">{room.name}</span>
                          <span className="text-xs text-petra-muted mr-2">
                            · קיבולת {room.capacity}
                          </span>
                          <span className="text-xs text-petra-muted">
                            · {room._count.boardingStays} פעילות
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted hover:text-petra-text transition-colors"
                            onClick={() => startEditRoom(room)}
                            title="ערוך"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => deleteRoomMutation.mutate(room.id)}
                            disabled={room._count.boardingStays > 0 || deleteRoomMutation.isPending}
                            title={room._count.boardingStays > 0 ? "לא ניתן למחוק חדר עם שהיות פעילות" : "מחק חדר"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new room form */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-petra-text mb-3">הוסף חדר חדש</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">שם החדר *</label>
                  <input
                    className="input"
                    placeholder='לדוגמה: חדר 5, חדר פרמיום...'
                    value={newRoomForm.name}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, name: e.target.value })}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="label">קיבולת</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={newRoomForm.capacity}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, capacity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="label">סוג</label>
                    <select
                      className="input"
                      value={newRoomForm.type}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, type: e.target.value })}
                    >
                      <option value="standard">רגיל</option>
                      <option value="premium">פרמיום</option>
                      <option value="suite">סוויט</option>
                    </select>
                  </div>
                </div>
                <button
                  className="btn-primary w-full"
                  disabled={!newRoomForm.name.trim() || createRoomMutation.isPending}
                  onClick={() => createRoomMutation.mutate(newRoomForm)}
                >
                  <Plus className="w-4 h-4" />
                  {createRoomMutation.isPending ? "מוסיף..." : "הוסף חדר"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Stay Modal ── */}
      {showNewStay && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowNewStay(false)} />
          <div className="modal-content max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-petra-text">שהייה חדשה</h2>
                <p className="text-sm text-petra-muted mt-0.5">הוסף שהייה לפנסיון</p>
              </div>
              <button
                onClick={() => setShowNewStay(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* ── Customer selector with search ── */}
              <div>
                <label className="label">לקוח *</label>
                {form.customerId && selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50 border border-brand-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm flex-shrink-0">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-petra-text">{selectedCustomer.name}</p>
                        <p className="text-[10px] text-petra-muted" dir="ltr">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, customerId: "", petId: "" }); setCustomerSearch(""); }}
                      className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                    >
                      שנה
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative mb-2">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        className="input pr-10"
                        placeholder="חיפוש לפי שם או טלפון..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-petra-border rounded-xl divide-y divide-petra-border">
                      {filteredCustomers.length === 0 ? (
                        <div className="py-4 text-center text-sm text-petra-muted">לא נמצאו לקוחות</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setForm({ ...form, customerId: c.id, petId: "" }); setCustomerSearch(""); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors text-right"
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-petra-text truncate">{c.name}</p>
                              <p className="text-[10px] text-petra-muted" dir="ltr">{c.phone}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Pet selector ── */}
              {selectedCustomer && (
                <div>
                  <label className="label">חיית מחמד *</label>
                  <select
                    className="input"
                    value={form.petId}
                    onChange={(e) => setForm({ ...form, petId: e.target.value })}
                  >
                    <option value="">בחר...</option>
                    {selectedCustomer.pets.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Room selector ── */}
              <div>
                <label className="label">חדר</label>
                <select
                  className="input"
                  value={form.roomId}
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                >
                  <option value="">ללא חדר</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r._count.boardingStays}/{r.capacity} תפוס)
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Check-in: date + time ── */}
              <div>
                <label className="label">צ׳ק-אין *</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="input"
                    value={form.checkIn}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                  />
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                    <input
                      type="time"
                      className="input pr-9"
                      value={form.checkInTime}
                      onChange={(e) => setForm({ ...form, checkInTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* ── Check-out: date + time ── */}
              <div>
                <label className="label">צ׳ק-אאוט</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className="input"
                    value={form.checkOut}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                  />
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                    <input
                      type="time"
                      className="input pr-9"
                      value={form.checkOutTime}
                      onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* ── Notes ── */}
              <div>
                <label className="label">הערות</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1"
                disabled={!form.customerId || !form.petId || !form.checkIn || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? "שומר..." : "צור שהייה"}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewStay(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
