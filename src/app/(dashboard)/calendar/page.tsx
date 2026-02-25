"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Clock,
  Phone,
  PawPrint,
} from "lucide-react";
import {
  cn,
  fetchJSON,
  getStatusColor,
  getStatusLabel,
  toWhatsAppPhone,
} from "@/lib/utils";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface AppointmentEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  service: {
    id: string;
    name: string;
    type: string;
    color: string | null;
    duration: number;
    price: number;
  };
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

interface BoardingStayEvent {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  pet: { id: string; name: string; species: string };
  customer: { id: string; name: string };
  room: { id: string; name: string } | null;
}

type ViewMode = "day" | "week" | "month";

// ─── Constants ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const DAYS_HE = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "day", label: "יום" },
  { id: "week", label: "שבוע" },
  { id: "month", label: "חודש" },
];

const SERVICE_TYPE_COLORS: Record<string, string> = {
  training: "#3B82F6",
  grooming: "#EC4899",
  boarding: "#10B981",
  daycare: "#F59E0B",
  consultation: "#8B5CF6",
  other: "#78716C",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  training: "אילוף",
  grooming: "טיפוח",
  boarding: "פנסיון",
  daycare: "דיי קר",
  consultation: "ייעוץ",
  other: "אחר",
};

const DAY_START = 8 * 60;
const SLOT_HEIGHT = 64;

// ─── Utility Functions ───────────────────────────────────────────────────────

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

function appointmentStyle(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime) - DAY_START;
  const end = timeToMinutes(endTime) - DAY_START;
  const top = (start / 60) * SLOT_HEIGHT;
  const height = Math.max(((end - start) / 60) * SLOT_HEIGHT, 24);
  return { top, height };
}

function getAppointmentColor(service: {
  color: string | null;
  type: string;
}): string {
  return service.color || SERVICE_TYPE_COLORS[service.type] || "#78716C";
}

function getMonthGrid(anchor: Date): Date[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

// ─── Hover Preview Card ─────────────────────────────────────────────────────

function HoverPreviewCard({
  appointment,
  x,
  y,
}: {
  appointment: AppointmentEvent;
  x: number;
  y: number;
}) {
  const color = getAppointmentColor(appointment.service);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const waPhone = toWhatsAppPhone(appointment.customer.phone);

  return (
    <div
      className="fixed bg-white rounded-xl shadow-card-hover border border-petra-border p-4 animate-fade-in pointer-events-none"
      style={{
        top: Math.max(8, Math.min(y - 70, window.innerHeight - 220)),
        left: Math.max(8, x - 260),
        zIndex: 100,
        width: 248,
      }}
    >
      <div
        className="h-1 rounded-full mb-3"
        style={{ background: color }}
      />
      <div className="font-bold text-sm text-petra-text">
        {appointment.customer.name}
      </div>
      {appointment.pet && (
        <div className="flex items-center gap-1 text-xs text-petra-muted mt-0.5">
          <PawPrint className="w-3 h-3" />
          {appointment.pet.name} (
          {appointment.pet.species === "dog"
            ? "כלב"
            : appointment.pet.species === "cat"
            ? "חתול"
            : "אחר"}
          )
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-2 text-xs text-petra-muted">
        <Clock className="w-3.5 h-3.5" />
        <span>
          {appointment.startTime} – {appointment.endTime}
        </span>
        <span className="opacity-50">·</span>
        <span>{appointment.service.duration} דק׳</span>
      </div>
      <div className="text-xs font-medium mt-1.5" style={{ color }}>
        {appointment.service.name}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs text-petra-muted">
        <Phone className="w-3.5 h-3.5" />
        {appointment.customer.phone}
      </div>
      <div className="mt-2">
        <span
          className={cn(
            "badge text-[10px]",
            getStatusColor(appointment.status)
          )}
        >
          {getStatusLabel(appointment.status)}
        </span>
      </div>
    </div>
  );
}

// ─── New Appointment Modal ───────────────────────────────────────────────────

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

  // Sync form with props when modal opens with new date/time
  useEffect(() => {
    if (isOpen) {
      setForm((prev) => ({
        ...prev,
        date: defaultDate,
        startTime: defaultTime,
      }));
    }
  }, [isOpen, defaultDate, defaultTime]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-select"],
    queryFn: () => fetchJSON("/api/customers?full=1"),
    enabled: isOpen,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => fetchJSON("/api/services"),
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
      setForm({
        customerId: "",
        serviceId: "",
        petId: "",
        date: defaultDate,
        startTime: defaultTime,
        notes: "",
      });
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
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">לקוח *</label>
            <select
              className="input"
              value={form.customerId}
              onChange={(e) =>
                setForm({ ...form, customerId: e.target.value, petId: "" })
              }
            >
              <option value="">בחר לקוח...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">שירות *</label>
            <select
              className="input"
              value={form.serviceId}
              onChange={(e) =>
                setForm({ ...form, serviceId: e.target.value })
              }
            >
              <option value="">בחר שירות...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.duration} דק׳ — ₪{s.price}
                </option>
              ))}
            </select>
          </div>
          {selectedCustomer && selectedCustomer.pets?.length > 0 && (
            <div>
              <label className="label">חיית מחמד</label>
              <select
                className="input"
                value={form.petId}
                onChange={(e) => setForm({ ...form, petId: e.target.value })}
              >
                <option value="">ללא</option>
                {selectedCustomer.pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך *</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">שעה *</label>
              <input
                type="time"
                className="input"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
              />
              {selectedService && (
                <p className="text-xs text-petra-muted mt-1">סיום: {endTime}</p>
              )}
            </div>
          </div>
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
            disabled={
              !form.customerId || !form.serviceId || mutation.isPending
            }
            onClick={() => mutation.mutate({ ...form, endTime })}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "צור פגישה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Calendar Page ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── State ──
  const [anchor, setAnchor] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [showNewModal, setShowNewModal] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({
    date: "",
    time: "09:00",
  });
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentEvent | null>(null);
  const [hoveredApt, setHoveredApt] = useState<{
    apt: AppointmentEvent;
    x: number;
    y: number;
  } | null>(null);
  const [now, setNow] = useState(new Date());

  // ── Current time tick ──
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // ── Date range computation ──
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const monthGrid = useMemo(
    () => (viewMode === "month" ? getMonthGrid(anchor) : []),
    [anchor, viewMode]
  );

  const { from, to } = useMemo(() => {
    if (viewMode === "day") {
      const dayStr = toLocalDateString(selectedDay);
      return { from: dayStr, to: dayStr };
    }
    if (viewMode === "month" && monthGrid.length > 0) {
      return {
        from: toLocalDateString(monthGrid[0]),
        to: toLocalDateString(monthGrid[monthGrid.length - 1]),
      };
    }
    return {
      from: toLocalDateString(weekDates[0]),
      to: toLocalDateString(weekDates[6]),
    };
  }, [viewMode, selectedDay, weekDates, monthGrid]);

  const today = toLocalDateString(new Date());

  // ── Data queries ──
  const { data: appointments = [] } = useQuery<AppointmentEvent[]>({
    queryKey: ["appointments", from, to],
    queryFn: () =>
      fetchJSON(`/api/appointments?from=${from}&to=${to}`),
  });

  const { data: boardingStays = [] } = useQuery<BoardingStayEvent[]>({
    queryKey: ["boarding-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/boarding?from=${from}&to=${to}`),
    enabled: viewMode !== "month",
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

  // ── Navigation ──
  const navigate = (direction: -1 | 1) => {
    if (viewMode === "day") {
      const d = new Date(selectedDay);
      d.setDate(d.getDate() + direction);
      setSelectedDay(d);
      setAnchor(d);
    } else if (viewMode === "week") {
      const d = new Date(anchor);
      d.setDate(d.getDate() + direction * 7);
      setAnchor(d);
    } else {
      const d = new Date(anchor);
      d.setMonth(d.getMonth() + direction);
      setAnchor(d);
    }
  };

  const goToToday = () => {
    const n = new Date();
    setAnchor(n);
    setSelectedDay(n);
  };

  // ── Header subtitle ──
  const headerSubtitle = useMemo(() => {
    if (viewMode === "day") {
      return selectedDay.toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "month") {
      return anchor.toLocaleDateString("he-IL", {
        month: "long",
        year: "numeric",
      });
    }
    return `${weekDates[0].toLocaleDateString("he-IL", { day: "numeric", month: "long" })} – ${weekDates[6].toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}`;
  }, [viewMode, selectedDay, anchor, weekDates]);

  // ── Current time indicator ──
  const currentTimeTop = useMemo(() => {
    const todayStr = toLocalDateString(now);
    if (viewMode === "month") return null;
    if (viewMode === "day" && toLocalDateString(selectedDay) !== todayStr)
      return null;
    if (
      viewMode === "week" &&
      !weekDates.some((d) => toLocalDateString(d) === todayStr)
    )
      return null;
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < DAY_START || minutes > DAY_START + 13 * 60) return null;
    return ((minutes - DAY_START) / 60) * SLOT_HEIGHT;
  }, [now, viewMode, selectedDay, weekDates]);

  const todayColumnIndex = useMemo(() => {
    if (viewMode !== "week") return -1;
    const todayStr = toLocalDateString(now);
    return weekDates.findIndex((d) => toLocalDateString(d) === todayStr);
  }, [now, viewMode, weekDates]);

  // ── Hover handlers ──
  const handleHoverEnter = (apt: AppointmentEvent, e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHoveredApt({ apt, x: rect.left, y: rect.top + rect.height / 2 });
    }, 300);
  };

  const handleHoverLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredApt(null);
  };

  // ── All-day stays computation for week view ──
  const allDayStays = useMemo(() => {
    if (viewMode === "month" || boardingStays.length === 0) return [];
    return boardingStays;
  }, [boardingStays, viewMode]);

  // ── Day view helpers ──
  const dayAppointments = useMemo(() => {
    if (viewMode !== "day") return [];
    const dayStr = toLocalDateString(selectedDay);
    return appointments.filter((a) => a.date.slice(0, 10) === dayStr);
  }, [appointments, selectedDay, viewMode]);

  // ── Render appointment block (shared by day/week) ──
  const renderAppointmentBlock = (
    apt: AppointmentEvent,
    style: React.CSSProperties,
    compact: boolean
  ) => {
    const color = getAppointmentColor(apt.service);
    const isCanceled = apt.status === "canceled";
    return (
      <div
        key={apt.id}
        className={cn(
          "absolute rounded-lg px-2 py-1 overflow-hidden cursor-pointer transition-all text-white",
          compact ? "text-xs" : "text-sm",
          isCanceled ? "opacity-40" : "hover:brightness-95"
        )}
        style={{
          ...style,
          background: color,
          boxShadow: isCanceled ? "none" : `0 1px 3px ${color}40`,
          zIndex: 10,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAppointment(apt);
        }}
        onMouseEnter={(e) => handleHoverEnter(apt, e)}
        onMouseLeave={handleHoverLeave}
      >
        {/* Status dots */}
        {apt.status === "completed" && (
          <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-green-300 border border-green-400" />
        )}
        {apt.status === "no_show" && (
          <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-gray-300 border border-gray-400" />
        )}

        <div className={cn("font-medium truncate", isCanceled && "line-through")}>
          {apt.customer.name}
        </div>
        <div className="opacity-80 truncate">{apt.service.name}</div>
        {!compact && apt.pet && (
          <div className="opacity-70 truncate">{apt.pet.name}</div>
        )}
        <div className="opacity-80">{apt.startTime}</div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title">יומן</h1>
        <p className="text-sm text-petra-muted">{headerSubtitle}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-white border border-petra-border rounded-xl overflow-hidden">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setViewMode(mode.id);
                  if (mode.id === "day" && viewMode !== "day") {
                    setSelectedDay(new Date());
                  }
                }}
                className={cn(
                  "px-3.5 py-2 text-sm font-medium transition-colors",
                  viewMode === mode.id
                    ? "bg-brand-50 text-brand-600"
                    : "text-petra-muted hover:text-petra-text hover:bg-slate-50"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary p-2"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="btn-secondary text-xs px-3"
          >
            היום
          </button>
          <button
            onClick={() => navigate(1)}
            className="btn-secondary p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* New appointment */}
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

      {/* ── Color Legend ── */}
      <div className="flex items-center gap-4 flex-wrap mb-4 px-1">
        {Object.entries(SERVICE_TYPE_COLORS).map(([type, color]) => (
          <div
            key={type}
            className="flex items-center gap-1.5 text-xs text-petra-muted"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: color }}
            />
            <span>{SERVICE_TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      {/* ═══════════════ WEEK VIEW ═══════════════ */}
      {viewMode === "week" && (
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
                    <div
                      key={i}
                      className={cn(
                        "p-3 text-center border-r border-petra-border cursor-pointer hover:bg-slate-50/50 transition-colors",
                        isToday && "bg-brand-50/30"
                      )}
                      onClick={() => {
                        setSelectedDay(date);
                        setViewMode("day");
                      }}
                    >
                      <div className="text-xs text-petra-muted font-medium">
                        {DAYS_HE[i]}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-bold mt-0.5",
                          isToday ? "text-brand-500" : "text-petra-text"
                        )}
                      >
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All-day boarding section */}
              {allDayStays.length > 0 && (
                <div className="border-b border-petra-border bg-slate-50/30">
                  <div className="grid grid-cols-[60px_1fr]">
                    <div className="flex items-center justify-center text-[10px] text-petra-muted p-1">
                      כל היום
                    </div>
                    <div className="py-1.5 px-1 space-y-1">
                      {allDayStays.map((stay) => {
                        const stayStart = new Date(stay.checkIn);
                        const stayEnd = stay.checkOut
                          ? new Date(stay.checkOut)
                          : weekDates[6];
                        const startIdx = Math.max(
                          0,
                          weekDates.findIndex(
                            (d) =>
                              toLocalDateString(d) >=
                              toLocalDateString(stayStart)
                          )
                        );
                        const endIdx = Math.min(
                          6,
                          (() => {
                            const endStr = toLocalDateString(stayEnd);
                            let last = 6;
                            for (let i = 0; i < 7; i++) {
                              if (toLocalDateString(weekDates[i]) <= endStr)
                                last = i;
                            }
                            return last;
                          })()
                        );
                        const isCheckedIn = stay.status === "checked_in";
                        const leftPct = (startIdx / 7) * 100;
                        const widthPct =
                          ((endIdx - startIdx + 1) / 7) * 100;

                        return (
                          <div
                            key={stay.id}
                            className={cn(
                              "h-6 rounded-md text-[10px] font-medium flex items-center px-2 truncate border",
                              isCheckedIn
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-violet-50 border-violet-200 text-violet-700"
                            )}
                            style={{
                              marginRight: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                          >
                            {stay.pet.name} ·{" "}
                            {stay.room?.name || "ללא חדר"}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Time grid */}
              <div className="relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[60px_repeat(7,1fr)]"
                    style={{ height: SLOT_HEIGHT }}
                  >
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
                            setModalDefaults({
                              date: dateStr,
                              time: `${String(hour).padStart(2, "0")}:00`,
                            });
                            setShowNewModal(true);
                          }}
                        />
                      );
                    })}
                  </div>
                ))}

                {/* Appointment blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const dayAppts = appointments.filter(
                    (a) => a.date.slice(0, 10) === dateStr
                  );
                  return dayAppts.map((apt) => {
                    const { top, height } = appointmentStyle(
                      apt.startTime,
                      apt.endTime
                    );
                    return renderAppointmentBlock(
                      apt,
                      {
                        top,
                        height,
                        right: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        marginRight: 2,
                      },
                      true
                    );
                  });
                })}

                {/* Current time indicator */}
                {currentTimeTop !== null && todayColumnIndex >= 0 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: currentTimeTop,
                      right: `calc(60px + ${todayColumnIndex} * (100% - 60px) / 7)`,
                      width: `calc((100% - 60px) / 7)`,
                      zIndex: 20,
                    }}
                  >
                    <div className="absolute -top-[5px] right-[-5px] w-[10px] h-[10px] rounded-full bg-red-500" />
                    <div className="h-[2px] bg-red-500 w-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DAY VIEW ═══════════════ */}
      {viewMode === "day" && (
        <div className="card overflow-hidden">
          {/* All-day boarding section */}
          {allDayStays.length > 0 && (
            <div className="border-b border-petra-border bg-slate-50/30 p-3">
              <div className="text-[10px] text-petra-muted font-medium mb-1.5">
                כל היום
              </div>
              <div className="space-y-1">
                {allDayStays
                  .filter((stay) => {
                    const dayStr = toLocalDateString(selectedDay);
                    const startStr = stay.checkIn.slice(0, 10);
                    const endStr = stay.checkOut?.slice(0, 10) || "9999-12-31";
                    return startStr <= dayStr && endStr >= dayStr;
                  })
                  .map((stay) => {
                    const isCheckedIn = stay.status === "checked_in";
                    return (
                      <div
                        key={stay.id}
                        className={cn(
                          "h-7 rounded-lg text-xs font-medium flex items-center px-3 border",
                          isCheckedIn
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-violet-50 border-violet-200 text-violet-700"
                        )}
                      >
                        {stay.pet.name} · {stay.room?.name || "ללא חדר"} ·{" "}
                        {stay.customer.name}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Time grid */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[60px_1fr]"
                style={{ height: SLOT_HEIGHT }}
              >
                <div className="flex items-start justify-center pt-1 text-xs text-petra-muted border-t border-slate-100">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div
                  className="border-r border-t border-slate-100 relative cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => {
                    setModalDefaults({
                      date: toLocalDateString(selectedDay),
                      time: `${String(hour).padStart(2, "0")}:00`,
                    });
                    setShowNewModal(true);
                  }}
                />
              </div>
            ))}

            {/* Appointment blocks */}
            {dayAppointments.map((apt) => {
              const { top, height } = appointmentStyle(
                apt.startTime,
                apt.endTime
              );
              return renderAppointmentBlock(
                apt,
                {
                  top,
                  height,
                  right: 60,
                  width: "calc(100% - 64px)",
                },
                false
              );
            })}

            {/* Current time indicator */}
            {currentTimeTop !== null && (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: currentTimeTop,
                  right: 0,
                  width: "100%",
                  zIndex: 20,
                }}
              >
                <div className="absolute -top-[5px] right-[55px] w-[10px] h-[10px] rounded-full bg-red-500" />
                <div
                  className="h-[2px] bg-red-500"
                  style={{ marginRight: 60 }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ MONTH VIEW ═══════════════ */}
      {viewMode === "month" && (
        <div className="card overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-petra-border">
            {DAYS_HE.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-petra-muted"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7">
            {monthGrid.map((date, idx) => {
              const dateStr = toLocalDateString(date);
              const isCurrentMonth = date.getMonth() === anchor.getMonth();
              const isToday = dateStr === today;
              const dayAppts = appointments.filter(
                (a) => a.date.slice(0, 10) === dateStr
              );
              const shown = dayAppts.slice(0, 3);
              const overflow = dayAppts.length - 3;

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[72px] md:min-h-[96px] p-2 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors",
                    !isCurrentMonth && "bg-slate-50/30"
                  )}
                  onClick={() => {
                    setSelectedDay(date);
                    setViewMode("day");
                    setAnchor(date);
                  }}
                >
                  <div className="flex items-center justify-end mb-1">
                    <div
                      className={cn(
                        "text-sm font-bold",
                        isToday
                          ? "text-white bg-brand-500 w-7 h-7 rounded-full flex items-center justify-center"
                          : isCurrentMonth
                          ? "text-petra-text"
                          : "text-petra-muted/40"
                      )}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                  {shown.length > 0 && (
                    <div className="space-y-0.5">
                      {shown.map((apt) => {
                        const color = getAppointmentColor(apt.service);
                        return (
                          <div
                            key={apt.id}
                            className="flex items-center gap-1 text-[10px] truncate"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(apt);
                            }}
                          >
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: color }}
                            />
                            <span
                              className={cn(
                                "truncate",
                                isCurrentMonth
                                  ? "text-petra-text"
                                  : "text-petra-muted/40"
                              )}
                            >
                              {apt.startTime} {apt.customer.name}
                            </span>
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="text-[10px] text-petra-muted font-medium pr-3">
                          +{overflow} עוד
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hover Preview ── */}
      {hoveredApt && (
        <HoverPreviewCard
          appointment={hoveredApt.apt}
          x={hoveredApt.x}
          y={hoveredApt.y}
        />
      )}

      {/* ── Appointment Detail Popup ── */}
      {selectedAppointment && (
        <div className="modal-overlay">
          <div
            className="modal-backdrop"
            onClick={() => setSelectedAppointment(null)}
          />
          <div className="modal-content max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-petra-text">
                {selectedAppointment.customer.name}
              </h3>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-petra-muted">
                <Clock className="w-4 h-4" />
                {selectedAppointment.startTime} –{" "}
                {selectedAppointment.endTime}
              </div>
              <div className="flex items-center gap-2 text-petra-muted">
                <Phone className="w-4 h-4" />
                <a
                  href={`https://wa.me/${toWhatsAppPhone(selectedAppointment.customer.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-green-600 transition-colors"
                >
                  {selectedAppointment.customer.phone}
                </a>
              </div>
              {selectedAppointment.pet && (
                <div className="flex items-center gap-2 text-petra-muted">
                  <PawPrint className="w-4 h-4" />
                  {selectedAppointment.pet.name}
                </div>
              )}
              <div className="text-petra-text font-medium">
                {selectedAppointment.service.name}
              </div>
              {selectedAppointment.notes && (
                <p className="text-petra-muted">
                  {selectedAppointment.notes}
                </p>
              )}
              <div className="mt-2">
                <span
                  className={cn(
                    "badge",
                    getStatusColor(selectedAppointment.status)
                  )}
                >
                  {getStatusLabel(selectedAppointment.status)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                className="btn-primary flex-1 text-xs"
                onClick={() =>
                  statusMutation.mutate({
                    id: selectedAppointment.id,
                    status: "completed",
                  })
                }
              >
                הושלם
              </button>
              <button
                className="btn-danger flex-1 text-xs"
                onClick={() =>
                  statusMutation.mutate({
                    id: selectedAppointment.id,
                    status: "canceled",
                  })
                }
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
