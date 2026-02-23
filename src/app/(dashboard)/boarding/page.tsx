"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Hotel,
  Plus,
  X,
  DoorOpen,
  PawPrint,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  pets: { id: string; name: string; species: string }[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  reserved: { label: "הזמנה", color: "#8B5CF6", bg: "#F5F3FF" },
  checked_in: { label: "נמצא", color: "#10B981", bg: "#ECFDF5" },
  checked_out: { label: "יצא", color: "#64748B", bg: "#F1F5F9" },
  canceled: { label: "בוטל", color: "#EF4444", bg: "#FEF2F2" },
};

export default function BoardingPage() {
  const [showNewStay, setShowNewStay] = useState(false);
  const [form, setForm] = useState({ customerId: "", petId: "", roomId: "", checkIn: "", checkOut: "", notes: "" });
  const queryClient = useQueryClient();

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => fetch("/api/boarding/rooms").then((r) => r.json()),
  });

  const { data: stays = [], isLoading } = useQuery<BoardingStay[]>({
    queryKey: ["boarding"],
    queryFn: () => fetch("/api/boarding").then((r) => r.json()),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-select"],
    queryFn: () => fetch("/api/customers?full=1").then((r) => r.json()),
    enabled: showNewStay,
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/boarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) throw new Error("Failed"); return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowNewStay(false);
      setForm({ customerId: "", petId: "", roomId: "", checkIn: "", checkOut: "", notes: "" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/boarding/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const activeStays = stays.filter((s) => s.status === "checked_in" || s.status === "reserved");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">פנסיון</h1>
          <p className="text-sm text-petra-muted mt-1">{activeStays.length} שהיות פעילות · {rooms.length} חדרים</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewStay(true)}>
          <Plus className="w-4 h-4" />שהייה חדשה
        </button>
      </div>

      {/* Rooms Grid */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-petra-text mb-3">חדרים</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {rooms.map((room) => {
            const occupancy = stays.filter((s) => s.room?.id === room.id && s.status === "checked_in").length;
            const isFull = occupancy >= room.capacity;
            return (
              <div key={room.id} className={cn("card p-3 text-center", isFull && "border-red-200 bg-red-50/30")}>
                <DoorOpen className={cn("w-5 h-5 mx-auto mb-1", isFull ? "text-red-400" : "text-brand-400")} />
                <div className="text-sm font-medium text-petra-text">{room.name}</div>
                <div className="text-xs text-petra-muted">{occupancy}/{room.capacity}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stays List */}
      <h2 className="text-sm font-semibold text-petra-text mb-3">שהיות</h2>
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-20" />)}</div>
      ) : stays.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Hotel className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין שהיות</h3>
          <p className="text-sm text-petra-muted mb-4">התחל על ידי הוספת שהייה חדשה</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stays.map((stay) => {
            const st = STATUS_MAP[stay.status] || STATUS_MAP.reserved;
            return (
              <div key={stay.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: st.bg }}>
                  <PawPrint className="w-5 h-5" style={{ color: st.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-petra-text">{stay.pet.name} — {stay.customer.name}</div>
                  <div className="text-xs text-petra-muted flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(stay.checkIn).toLocaleDateString("he-IL")}
                    {stay.checkOut ? ` → ${new Date(stay.checkOut).toLocaleDateString("he-IL")}` : ""}
                    {stay.room && <span>· {stay.room.name}</span>}
                  </div>
                </div>
                <span className="badge text-[10px]" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                {stay.status === "reserved" && (
                  <button className="btn-ghost text-xs" onClick={() => statusMutation.mutate({ id: stay.id, status: "checked_in" })}>
                    <CheckCircle2 className="w-3.5 h-3.5" />צ׳ק-אין
                  </button>
                )}
                {stay.status === "checked_in" && (
                  <button className="btn-ghost text-xs" onClick={() => statusMutation.mutate({ id: stay.id, status: "checked_out" })}>
                    <Clock className="w-3.5 h-3.5" />צ׳ק-אאוט
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Stay Modal */}
      {showNewStay && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowNewStay(false)} />
          <div className="modal-content max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-petra-text">שהייה חדשה</h2>
              <button onClick={() => setShowNewStay(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">לקוח *</label>
                <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, petId: "" })}>
                  <option value="">בחר לקוח...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {selectedCustomer && (
                <div>
                  <label className="label">חיית מחמד *</label>
                  <select className="input" value={form.petId} onChange={(e) => setForm({ ...form, petId: e.target.value })}>
                    <option value="">בחר...</option>
                    {selectedCustomer.pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">חדר</label>
                <select className="input" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
                  <option value="">ללא חדר</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} (קיבולת: {r.capacity})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">צ׳ק-אין *</label>
                  <input type="date" className="input" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
                </div>
                <div>
                  <label className="label">צ׳ק-אאוט</label>
                  <input type="date" className="input" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">הערות</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1" disabled={!form.customerId || !form.petId || !form.checkIn || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                <Plus className="w-4 h-4" />{createMutation.isPending ? "שומר..." : "צור שהייה"}
              </button>
              <button className="btn-secondary" onClick={() => setShowNewStay(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
