"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Clock,
  Phone,
} from "lucide-react";
import { cn, getStatusColor, getStatusLabel } from "@/lib/utils";

interface AppointmentEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  service: { id: string; name: string; color: string | null; duration: number; price: number };
  customer: { id: string; name: string; phone: string };
  pet: { id: string; name: string; species: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  pets: { id: string; name: string; species: string }[];
}

interface Service {
  id: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  color: string | null;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function getWeekDates(anchor: Date): Date[] {
  const day = anchor.getDay();
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(time: string, mins: number): string {
  const total = timeToMinutes(time) + mins;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DAY_START = 8 * 60;
const SLOT_HEIGHT = 64;

function appointmentStyle(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime) - DAY_START;
  const end = timeToMinutes(endTime) - DAY_START;
  const top = (start / 60) * SLOT_HEIGHT;
  const height = Math.max(((end - start) / 60) * SLOT_HEIGHT, 24);
  return { top, height };
}

function NewAppointmentModal({
  isOpen,
  onClose,
  defaultDate,
  defaultTime,
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultTime: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customerId: "",
    serviceId: "",
    petId: "",
    date: defaultDate,
    startTime: defaultTime,
    notes: "",
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-select"],
    queryFn: () => fetch("/api/customers?full=1").then((r) => r.json()),
    enabled: isOpen,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => fetch("/api/services").then((r) => r.json()),
    enabled: isOpen,
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  const selectedService = services.find((s) => s.id === form.serviceId);
  const endTime = selectedService
    ? addMinutes(form.startTime, selectedService.duration)
    : addMinutes(form.startTime, 60);

  const mutation = useMutation({
    mutationFn: (data: typeof form & { endTime: string }) =>
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      setForm({ customerId: "", serviceId: "", petId: "", date: defaultDate, startTime: defaultTime, notes: "" });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">פגישה חדשה</h2>
            <p className="text-sm text-petra-muted mt-0.5">קבע פגישה ביומן</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">לקוח *</label>
            <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, petId: "" })}>
              <option value="">בחר לקוח...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">שירות *</label>
            <select className="input" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">בחר שירות...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.duration} דק׳ — ₪{s.price}</option>
              ))}
            </select>
          </div>

          {selectedCustomer && selectedCustomer.pets?.length > 0 && (
            <div>
              <label className="label">חיית מחמד</label>
              <select className="input" value={form.petId} onChange={(e) => setForm({ ...form, petId: e.target.value })}>
                <option value="">ללא</option>
                {selectedCustomer.pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך *</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">שעה *</label>
              <input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              {selectedService && (
                <p className="text-xs text-petra-muted mt-1">סיום: {endTime}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">הערות</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.customerId || !form.serviceId || mutation.isPending}
            onClick={() => mutation.mutate({ ...form, endTime })}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "צור פגישה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [showNewModal, setShowNewModal] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({ date: "", time: "09:00" });
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentEvent | null>(null);

  const queryClient = useQueryClient();
  const weekDates = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);
  const from = toLocalDateString(weekDates[0]);
  const to = toLocalDateString(weekDates[6]);

  const { data: appointments = [] } = useQuery<AppointmentEvent[]>({
    queryKey: ["appointments", from, to],
    queryFn: () => fetch(`/api/appointments?from=${from}&to=${to}`).then((r) => r.json()),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelectedAppointment(null);
    },
  });

  const prevWeek = () => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() - 7);
    setWeekAnchor(d);
  };

  const nextWeek = () => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + 7);
    setWeekAnchor(d);
  };

  const today = toLocalDateString(new Date());

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">יומן</h1>
          <p className="text-sm text-petra-muted mt-1">
            {weekDates[0].toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
            {" – "}
            {weekDates[6].toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setWeekAnchor(new Date())} className="btn-secondary text-xs px-3">היום</button>
          <button onClick={nextWeek} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
          <button
            className="btn-primary"
            onClick={() => {
              setModalDefaults({ date: today, time: "09:00" });
              setShowNewModal(true);
            }}
          >
            <Plus className="w-4 h-4" />
            פגישה חדשה
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-petra-border">
              <div className="p-2" />
              {weekDates.map((date, i) => {
                const dateStr = toLocalDateString(date);
                const isToday = dateStr === today;
                return (
                  <div key={i} className={cn("p-3 text-center border-r border-petra-border", isToday && "bg-brand-50/30")}>
                    <div className="text-xs text-petra-muted font-medium">{DAYS_HE[i]}</div>
                    <div className={cn(
                      "text-lg font-bold mt-0.5",
                      isToday ? "text-brand-500" : "text-petra-text"
                    )}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: SLOT_HEIGHT }}>
                  <div className="flex items-start justify-center pt-1 text-xs text-petra-muted border-t border-slate-100">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDates.map((date, dayIdx) => {
                    const dateStr = toLocalDateString(date);
                    return (
                      <div
                        key={dayIdx}
                        className="border-r border-t border-slate-100 relative cursor-pointer hover:bg-slate-50/50 transition-colors"
                        onClick={() => {
                          setModalDefaults({ date: dateStr, time: `${String(hour).padStart(2, "0")}:00` });
                          setShowNewModal(true);
                        }}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Appointment blocks overlay */}
              {weekDates.map((date, dayIdx) => {
                const dateStr = toLocalDateString(date);
                const dayAppointments = appointments.filter(
                  (a) => a.date.slice(0, 10) === dateStr
                );

                return dayAppointments.map((apt) => {
                  const { top, height } = appointmentStyle(apt.startTime, apt.endTime);
                  const color = apt.service.color || "#F97316";
                  return (
                    <div
                      key={apt.id}
                      className="absolute rounded-lg px-2 py-1 overflow-hidden cursor-pointer hover:brightness-95 transition-all text-white text-xs"
                      style={{
                        top,
                        height,
                        right: `calc(60px + ${(dayIdx / 7) * 100}% * 7 / 7 + ${dayIdx} * (100% - 60px) / 7)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        marginRight: 2,
                        background: color,
                        boxShadow: `0 1px 3px ${color}40`,
                        zIndex: 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAppointment(apt);
                      }}
                    >
                      <div className="font-medium truncate">{apt.customer.name}</div>
                      <div className="opacity-80 truncate">{apt.service.name}</div>
                      <div className="opacity-80">{apt.startTime}</div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Detail Popup */}
      {selectedAppointment && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setSelectedAppointment(null)} />
          <div className="modal-content max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-petra-text">{selectedAppointment.customer.name}</h3>
              <button onClick={() => setSelectedAppointment(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-petra-muted">
                <Clock className="w-4 h-4" />
                {selectedAppointment.startTime} – {selectedAppointment.endTime}
              </div>
              <div className="flex items-center gap-2 text-petra-muted">
                <Phone className="w-4 h-4" />
                {selectedAppointment.customer.phone}
              </div>
              <div className="text-petra-text font-medium">{selectedAppointment.service.name}</div>
              {selectedAppointment.notes && (
                <p className="text-petra-muted">{selectedAppointment.notes}</p>
              )}
              <div className="mt-2">
                <span className={cn("badge", getStatusColor(selectedAppointment.status))}>
                  {getStatusLabel(selectedAppointment.status)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                className="btn-primary flex-1 text-xs"
                onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: "completed" })}
              >
                הושלם
              </button>
              <button
                className="btn-danger flex-1 text-xs"
                onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: "canceled" })}
              >
                בטל
              </button>
            </div>
          </div>
        </div>
      )}

      <NewAppointmentModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        defaultDate={modalDefaults.date}
        defaultTime={modalDefaults.time}
      />
    </div>
  );
}
