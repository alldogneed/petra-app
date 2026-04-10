"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Clock,
  Phone,
  PawPrint,
  ShoppingCart,
  ListTodo,
  Hotel,
  MessageCircle,
  Pencil,
  Check,
  Trash2,
  UserX,
  CreditCard,
  AlertCircle,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  cn,
  fetchJSON,
  getStatusColor,
  getStatusLabel,
  toWhatsAppPhone,
} from "@/lib/utils";
import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
import { getMaxAppointments } from "@/lib/feature-flags";
import { TierGate } from "@/components/paywall/TierGate";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface PriceListItem {
  id: string;
  name: string;
  category: string | null;
  durationMinutes: number | null;
  basePrice: number;
}

interface AppointmentEvent {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  cancellationNote: string | null;
  service: {
    id: string;
    name: string;
    type: string;
    color: string | null;
    duration: number;
    price: number;
  } | null;
  priceListItem: PriceListItem | null;
  customer: { id: string; name: string; phone: string };
  pet: { id: string; name: string; species: string } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  pets: { id: string; name: string; species: string }[];
}

/** Build a Google Calendar pre-fill URL for a home training appointment */

interface BoardingStayEvent {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  pet: { id: string; name: string; species: string };
  customer: { id: string; name: string };
  room: { id: string; name: string } | null;
}

interface OrderEvent {
  id: string;
  orderType: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  total: number;
  notes: string | null;
  customer: { id: string; name: string; phone: string };
  lines: { id: string; name: string; quantity: number; unitPrice: number }[];
}

interface TaskEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  dueAt: string | null;
  dueDate: string | null;
}

interface BookingCalEvent {
  id: string;
  startAt: string;
  endAt: string;
  status: string; // "pending" | "confirmed"
  service: { id: string; name: string; type: string };
  customer: { id: string; name: string; phone: string };
  dogs: { pet: { id: string; name: string } }[];
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

const ORDER_TYPE_COLORS: Record<string, string> = {
  // Legacy
  sale: "#F97316",
  appointment: "#6366F1",
  // New types
  products: "#F97316",
  boarding: "#10B981",
  training: "#3B82F6",
  grooming: "#EC4899",
  service_dog: "#8B5CF6",
};


const TASK_PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#9CA3AF",
};

const TASK_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "כללי",
  BOARDING: "פנסיון",
  TRAINING: "אילוף",
  LEADS: "לידים",
  HEALTH: "בריאות",
  MEDICATION: "תרופות",
  FEEDING: "האכלה",
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
  const height = Math.max(((end - start) / 60) * SLOT_HEIGHT, 40);
  return { top, height };
}

const CATEGORY_COLORS: Record<string, string> = {
  אילוף: "#3B82F6",
  טיפוח: "#EC4899",
  פנסיון: "#10B981",
  מוצרים: "#F97316",
};

function getAppointmentColor(
  service: { color: string | null; type: string } | null,
  priceListItem?: { category: string | null } | null
): string {
  if (service?.color) return service.color;
  if (priceListItem?.category) return CATEGORY_COLORS[priceListItem.category] ?? "#78716C";
  return SERVICE_TYPE_COLORS[service?.type ?? "other"] ?? "#78716C";
}

function getAppointmentLabel(apt: AppointmentEvent): string {
  return apt.service?.name ?? apt.priceListItem?.name ?? apt.notes ?? "תור";
}

function getAppointmentDuration(apt: AppointmentEvent): number {
  return apt.service?.duration ?? apt.priceListItem?.durationMinutes ?? 60;
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

function dateTimeToTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateTimeToDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const color = getAppointmentColor(appointment.service, appointment.priceListItem);
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
        <span>{getAppointmentDuration(appointment)} דק׳</span>
      </div>
      <div className="text-xs font-medium mt-1.5" style={{ color }}>
        {getAppointmentLabel(appointment)}
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
  existingAppointments = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultDate: string;
  defaultTime: string;
  existingAppointments?: AppointmentEvent[];
}) {
  const queryClient = useQueryClient();
  const { can: canPlan } = usePlan();
  const [form, setForm] = useState({
    customerId: "",
    priceListItemId: "",
    petId: "",
    date: defaultDate,
    startTime: defaultTime,
    notes: "",
  });
  const [recurring, setRecurring] = useState(false);
  const [repeatEvery, setRepeatEvery] = useState<"week" | "2weeks" | "month">("week");
  const [occurrences, setOccurrences] = useState(4);

  // Sync form with props when modal opens with new date/time
  useEffect(() => {
    if (isOpen) {
      setForm((prev) => ({
        ...prev,
        date: defaultDate,
        startTime: defaultTime,
        priceListItemId: "",
      }));
      setRecurring(false);
      setRepeatEvery("week");
      setOccurrences(4);
    }
  }, [isOpen, defaultDate, defaultTime]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-select"],
    queryFn: () => fetchJSON("/api/customers?full=1"),
    enabled: isOpen,
  });

  const { data: priceListItems = [] } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items-all-active"],
    queryFn: () => fetch("/api/price-list-items").then((r) => r.json()),
    enabled: isOpen,
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);
  const selectedItem = priceListItems.find((i) => i.id === form.priceListItemId);
  const endTime = selectedItem?.durationMinutes
    ? addMinutes(form.startTime, selectedItem.durationMinutes)
    : addMinutes(form.startTime, 60);

  const mutation = useMutation({
    mutationFn: (data: typeof form & { endTime: string }) => {
      if (recurring) {
        return fetch("/api/appointments/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, repeatEvery, occurrences }),
        }).then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.json();
        });
      }
      return fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (recurring && result?.created) {
        toast.success(`נקבעו ${result.created} פגישות חוזרות בהצלחה`);
      } else {
        const newId = result?.id as string | undefined;
        toast.success("התור נקבע בהצלחה", newId && selectedCustomer?.phone && canPlan("whatsapp_reminders") ? {
          action: {
            label: "שלח תזכורת WhatsApp",
            onClick: () => fetch(`/api/appointments/${newId}/remind`, { method: "POST" })
              .then((r) => r.json())
              .then((d) => { if (d.success) toast.success("תזכורת נשלחה"); else toast.error(d.error ?? "שגיאה"); })
              .catch(() => toast.error("שגיאה בשליחה")),
          },
        } : undefined);
      }
      onClose();
      setForm({
        customerId: "",
        priceListItemId: "",
        petId: "",
        date: defaultDate,
        startTime: defaultTime,
        notes: "",
      });
    },
    onError: (err: Error) => {
      if (err.message?.includes("מוגבל") || err.message?.includes("50")) {
        toast.error("הגעת למגבלת הפגישות — שדרג לבייסיק כדי להוסיף עוד");
      } else {
        toast.error("שגיאה בקביעת התור. נסה שוב.");
      }
    },
  });

  // Conflict detection
  const conflictingApts = useMemo(() => {
    if (!form.date || !form.startTime || !selectedItem) return [];
    const newStart = timeToMinutes(form.startTime);
    const newEnd = timeToMinutes(endTime);
    return existingAppointments.filter((a) => {
      if (a.status === "canceled") return false;
      const aDate = new Date(a.date).toLocaleDateString("sv"); // YYYY-MM-DD
      if (aDate !== form.date) return false;
      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      return newStart < aEnd && newEnd > aStart;
    });
  }, [form.date, form.startTime, endTime, existingAppointments, selectedItem]);

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
            <label className="label">שירות / מוצר *</label>
            <select
              className="input"
              value={form.priceListItemId}
              onChange={(e) =>
                setForm({ ...form, priceListItemId: e.target.value })
              }
            >
              <option value="">בחר מהמחירון...</option>
              {["אילוף", "טיפוח", "פנסיון", "מוצרים"].map((cat) => {
                const catItems = priceListItems.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {catItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}{i.durationMinutes ? ` — ${i.durationMinutes} דק׳` : ""} — ₪{i.basePrice}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              {priceListItems.filter((i) => !i.category || !["אילוף","טיפוח","פנסיון","מוצרים"].includes(i.category)).length > 0 && (
                <optgroup label="כללי">
                  {priceListItems.filter((i) => !i.category || !["אילוף","טיפוח","פנסיון","מוצרים"].includes(i.category)).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}{i.durationMinutes ? ` — ${i.durationMinutes} דק׳` : ""} — ₪{i.basePrice}
                    </option>
                  ))}
                </optgroup>
              )}
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
                type="date" lang="he"
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
              {selectedItem && (
                <p className="text-xs text-petra-muted mt-1">סיום: {endTime}</p>
              )}
            </div>
          </div>
          {/* Conflict warning */}
          {conflictingApts.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">התנגשות בלוח הזמנים! </span>
                {conflictingApts.map((a) => (
                  <span key={a.id}>
                    {a.customer.name} ({a.startTime}–{a.endTime} · {getAppointmentLabel(a)})
                  </span>
                )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
              </div>
            </div>
          )}

          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Recurring toggle */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-orange-500"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              <span className="text-sm font-medium text-petra-text">פגישה חוזרת</span>
            </label>
            {recurring && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label text-xs">תדירות</label>
                  <select
                    className="input text-sm"
                    value={repeatEvery}
                    onChange={(e) => setRepeatEvery(e.target.value as "week" | "2weeks" | "month")}
                  >
                    <option value="week">כל שבוע</option>
                    <option value="2weeks">כל שבועיים</option>
                    <option value="month">כל חודש</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">מספר פגישות</label>
                  <input
                    type="number"
                    className="input text-sm"
                    min={2}
                    max={52}
                    value={occurrences}
                    onChange={(e) => setOccurrences(Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2 text-xs text-petra-muted bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  ייצרו <strong>{occurrences}</strong> פגישות החל מ-{form.date || "התאריך שנבחר"}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={
              !form.customerId || !form.priceListItemId || mutation.isPending
            }
            onClick={() => mutation.mutate({ ...form, endTime })}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : recurring ? `צור ${occurrences} פגישות` : "צור פגישה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Payment Modal ─────────────────────────────────────────────────────

function QuickPaymentModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentEvent;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(appointment.service?.price || 0);
  const [method, setMethod] = useState("cash");

  const mutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method,
          status: "paid",
          customerId: appointment.customer.id,
          appointmentId: appointment.id,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      onClose();
      toast.success("התשלום נרשם בהצלחה");
    },
    onError: () => toast.error("שגיאה בשמירת התשלום. נסה שוב."),
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-petra-text">רישום תשלום</h2>
            <p className="text-xs text-petra-muted mt-0.5">
              {appointment.customer.name} · {getAppointmentLabel(appointment)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">סכום (₪)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">אמצעי תשלום</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">מזומן</option>
              <option value="credit_card">כרטיס אשראי</option>
              <option value="bit">ביט</option>
              <option value="paybox">פייבוקס</option>
              <option value="bank_transfer">העברה בנקאית</option>
              <option value="check">צ׳ק</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <CreditCard className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "שמור תשלום"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Calendar Page ──────────────────────────────────────────────────────

export default function CalendarPage() {
  return (
    <TierGate
      feature="appointments"
      title="יומן פגישות"
      description="קבע וניהל פגישות עם לקוחות — זמין במנוי בייסיק ומעלה."
    >
      <CalendarContent />
    </TierGate>
  );
}

function CalendarContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isFree, tier, can } = usePlan();
  const maxAppts = getMaxAppointments(tier);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);

  // ── State ──
  const [anchor, setAnchor] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "day" : "week"
  );
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [showNewModal, setShowNewModal] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({
    date: "",
    time: "09:00",
  });
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentEvent | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellationNote, setCancellationNote] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", startTime: "", endTime: "" });
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | null>(null);
  const [showQuickPayment, setShowQuickPayment] = useState(false);
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

  // ── Switch to Day view on small screens ──
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) setViewMode("day");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const [allDayCollapsed, setAllDayCollapsed] = useState(true);
  const [showGcal, setShowGcal] = useState(true);

  // Auto-scroll to current time when switching to day/week view
  useEffect(() => {
    if (viewMode !== "day" && viewMode !== "week") return;
    if (!timeGridRef.current) return;
    const currentHour = new Date().getHours();
    const gridTop = timeGridRef.current.getBoundingClientRect().top + window.scrollY;
    const scrollTarget = gridTop + (currentHour - 8) * SLOT_HEIGHT - 100;
    window.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
  }, [viewMode]);

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
  const { data: appointments = [], isError: appointmentsError } = useQuery<AppointmentEvent[]>({
    queryKey: ["appointments", from, to],
    queryFn: () =>
      fetchJSON(`/api/appointments?from=${from}&to=${to}`),
  });

  // Total appointment count — only fetched for free tier to show limit banner
  const { data: totalApptCount = 0 } = useQuery<number>({
    queryKey: ["appointments-total-count"],
    queryFn: () => fetchJSON<AppointmentEvent[]>("/api/appointments").then((r) => r.length),
    enabled: isFree && maxAppts !== null,
    staleTime: 60_000,
  });

  const SERVICE_TYPE_TO_CATEGORY: Record<string, string> = {
    training: "אילוף", grooming: "טיפוח", boarding: "פנסיון",
  };
  const filteredAppointments = useMemo(
    () => serviceTypeFilter
      ? appointments.filter((a) => {
          if (a.service?.type === serviceTypeFilter) return true;
          const cat = SERVICE_TYPE_TO_CATEGORY[serviceTypeFilter];
          return cat ? a.priceListItem?.category === cat : false;
        })
      : appointments,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, serviceTypeFilter]
  );

  const { data: boardingStays = [] } = useQuery<BoardingStayEvent[]>({
    queryKey: ["boarding-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/boarding?from=${from}&to=${to}`),
    enabled: viewMode !== "month",
  });

  const { data: orders = [] } = useQuery<OrderEvent[]>({
    queryKey: ["orders-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/orders?startFrom=${from}&startTo=${to}`),
  });

  const { data: tasks = [] } = useQuery<TaskEvent[]>({
    queryKey: ["tasks-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/tasks?from=${from}&to=${to}&status=OPEN`),
  });

  // Pending online bookings (not yet converted to appointments)
  const { data: pendingBookingsRaw = [] } = useQuery<BookingCalEvent[]>({
    queryKey: ["bookings-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/booking/bookings?status=pending&from=${from}&to=${to}`),
    enabled: viewMode !== "month",
  });

  const pendingBookings = useMemo(
    () => serviceTypeFilter
      ? pendingBookingsRaw.filter((b) => b.service.type === serviceTypeFilter)
      : pendingBookingsRaw,
    [pendingBookingsRaw, serviceTypeFilter]
  );

  // ── Google Calendar external events overlay ──
  interface GcalExternalEvent {
    id: string;
    title: string;
    start: string; // ISO datetime or YYYY-MM-DD for all-day
    end: string;
    isAllDay: boolean;
    calendarId: string;
    calendarName: string;
    backgroundColor: string;
    htmlLink?: string;
  }
  const { data: gcalExternalData } = useQuery<{ events: GcalExternalEvent[] }>({
    queryKey: ["gcal-external-events", from, to],
    queryFn: () => fetchJSON(`/api/integrations/google/external-events?start=${from}&end=${to}`),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const gcalEvents = gcalExternalData?.events ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status, cancellationNote }: { id: string; status: string; cancellationNote?: string }) =>
      fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(cancellationNote ? { cancellationNote } : {}) }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelectedAppointment(null);
      if (status === "completed") toast.success("התור סומן כהושלם");
      else if (status === "canceled") toast.success("התור בוטל");
    },
    onError: () => toast.error("שגיאה בעדכון התור. נסה שוב."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelectedAppointment(null);
      setConfirmDeleteId(null);
      toast.success("התור נמחק");
    },
    onError: () => toast.error("שגיאה במחיקת התור. נסה שוב."),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, date, startTime, endTime }: { id: string; date: string; startTime: string; endTime: string }) =>
      fetchJSON(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, endTime }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelectedAppointment(null);
      setRescheduling(false);
      toast.success("התור הועבר בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון התור. נסה שוב."),
  });

  const notesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      fetchJSON(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setEditingNotes(false);
      if (selectedAppointment) {
        setSelectedAppointment({ ...selectedAppointment, notes: notesInput || null });
      }
      toast.success("ההערות עודכנו");
    },
    onError: () => toast.error("שגיאה בעדכון ההערות. נסה שוב."),
  });

  const remindMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/appointments/${id}/remind`, { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "שגיאה");
        return data;
      }),
    onSuccess: () => toast.success("תזכורת WhatsApp נשלחה"),
    onError: (err: Error) => toast.error(err.message || "שגיאה בשליחת תזכורת"),
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
    return filteredAppointments.filter((a) => a.date.slice(0, 10) === dayStr);
  }, [filteredAppointments, selectedDay, viewMode]);

  // ── Day view helpers for orders & tasks ──
  const dayOrders = useMemo(() => {
    if (viewMode !== "day") return [];
    const dayStr = toLocalDateString(selectedDay);
    return orders.filter((o) => o.startAt && dateTimeToDateStr(o.startAt) === dayStr);
  }, [orders, selectedDay, viewMode]);

  const dayTimedTasks = useMemo(() => {
    if (viewMode !== "day") return [];
    const dayStr = toLocalDateString(selectedDay);
    return tasks.filter((t) => t.dueAt && dateTimeToDateStr(t.dueAt) === dayStr);
  }, [tasks, selectedDay, viewMode]);

  const dayAllDayTasks = useMemo(() => {
    if (viewMode !== "day") return [];
    const dayStr = toLocalDateString(selectedDay);
    return tasks.filter((t) => !t.dueAt && t.dueDate && t.dueDate.slice(0, 10) === dayStr);
  }, [tasks, selectedDay, viewMode]);

  // ── All-day tasks for week view ──
  const weekAllDayTasks = useMemo(() => {
    if (viewMode !== "week") return [];
    return tasks.filter((t) => !t.dueAt && t.dueDate);
  }, [tasks, viewMode]);

  // ── Render appointment block (shared by day/week) ──
  const renderAppointmentBlock = (
    apt: AppointmentEvent,
    style: React.CSSProperties,
    compact: boolean
  ) => {
    const color = getAppointmentColor(apt.service, apt.priceListItem);
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
          minHeight: compact ? undefined : 60,
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

        <div className={cn("font-medium", compact ? "truncate" : "line-clamp-2 break-words", isCanceled && "line-through")}>
          {apt.pet ? apt.pet.name : apt.customer.name}
        </div>
        {apt.pet && (
          <div className={cn("opacity-80", compact ? "truncate" : "line-clamp-1")}>{apt.customer.name}</div>
        )}
        <div className={cn("opacity-80", compact ? "truncate" : "line-clamp-1")}>{getAppointmentLabel(apt)}</div>
        <div className="opacity-80">{apt.startTime}</div>
      </div>
    );
  };

  // ── Render order block (shared by day/week) ──
  const renderOrderBlock = (
    order: OrderEvent,
    style: React.CSSProperties,
    compact: boolean
  ) => {
    const color = ORDER_TYPE_COLORS[order.orderType] || "#F97316";
    return (
      <div
        key={`order-${order.id}`}
        className={cn(
          "absolute rounded-lg px-2 py-1 overflow-hidden bg-white border border-slate-200",
          compact ? "text-xs" : "text-sm"
        )}
        style={{
          ...style,
          borderLeft: `3px dashed ${color}`,
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-1 font-medium text-petra-text truncate">
          <ShoppingCart className="w-3 h-3 flex-shrink-0" style={{ color }} />
          {order.customer.name}
        </div>
        {order.lines.length > 0 && (
          <div className="text-petra-muted truncate">{order.lines[0].name}</div>
        )}
        <div className="font-medium" style={{ color }}>
          ₪{order.total.toLocaleString()}
        </div>
      </div>
    );
  };

  // ── Render pending online booking block ──
  const renderBookingBlock = (
    booking: BookingCalEvent,
    style: React.CSSProperties,
    compact: boolean
  ) => {
    const startTime = dateTimeToTime(booking.startAt);
    const dogNames = booking.dogs.map((d) => d.pet.name).join(", ");
    return (
      <a
        key={`booking-${booking.id}`}
        href="/bookings"
        className={cn(
          "absolute rounded-lg px-2 py-1 overflow-hidden bg-amber-50 border border-dashed border-amber-400 cursor-pointer hover:bg-amber-100 transition-colors",
          compact ? "text-xs" : "text-sm"
        )}
        style={{ ...style, zIndex: 9 }}
        title="הזמנה אונליין ממתינה לאישור"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 font-medium text-amber-800 truncate">
          <AlertCircle className="w-3 h-3 flex-shrink-0 text-amber-500" />
          {booking.customer.name}
        </div>
        <div className="text-amber-600 truncate">{booking.service.name}</div>
        {!compact && dogNames && (
          <div className="text-amber-500 truncate">{dogNames}</div>
        )}
        <div className="text-amber-600">{startTime}</div>
      </a>
    );
  };

  // ── Render task block (shared by day/week) ──
  const renderTaskBlock = (
    task: TaskEvent,
    style: React.CSSProperties,
    compact: boolean
  ) => {
    const color = TASK_PRIORITY_COLORS[task.priority] || "#9CA3AF";
    return (
      <div
        key={`task-${task.id}`}
        className={cn(
          "absolute rounded-lg px-2 py-1 overflow-hidden bg-white border border-slate-200",
          compact ? "text-xs" : "text-sm"
        )}
        style={{
          ...style,
          borderRight: `3px solid ${color}`,
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-1 font-medium text-petra-text truncate">
          <ListTodo className="w-3 h-3 flex-shrink-0 text-petra-muted" />
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          {task.title}
        </div>
        {!compact && (
          <div className="text-petra-muted truncate">
            {TASK_CATEGORY_LABELS[task.category] || task.category}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageTitle title="יומן" />
      {appointmentsError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          שגיאה בטעינת התורים. נסה לרענן את הדף.
        </div>
      )}
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 mb-4 md:mb-6">
        {/* Top row: title + new appointment */}
        <div className="flex items-center gap-2">
          <div>
            <h1 className="page-title">יומן</h1>
            <p className="text-xs text-petra-muted mt-0.5">{headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Week Summary WhatsApp button — only in week view */}
            {viewMode === "week" && (() => {
              const weekAppts = filteredAppointments
                .filter((a) => a.status !== "canceled")
                .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime.localeCompare(b.startTime));
              if (weekAppts.length === 0) return null;
              const weekLabel = `${weekDates[0].toLocaleDateString("he-IL", { day: "numeric", month: "long" })} – ${weekDates[6].toLocaleDateString("he-IL", { day: "numeric", month: "long" })}`;
              const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
              const lines = [`📅 לוח שבוע — ${weekLabel}`, `סה"כ ${weekAppts.length} פגישות`, ""];
              const byDay: Record<string, typeof weekAppts> = {};
              for (const a of weekAppts) {
                const key = a.date.slice(0, 10);
                if (!byDay[key]) byDay[key] = [];
                byDay[key].push(a);
              }
              for (const dateStr of Object.keys(byDay).sort()) {
                const date = new Date(dateStr + "T00:00:00");
                const dayLabel = `${dayNames[date.getDay()]} ${date.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}`;
                lines.push(`📌 ${dayLabel}:`);
                byDay[dateStr].forEach((a, i) => {
                  lines.push(`  ${i + 1}. ${a.startTime} — ${a.customer.name}${a.pet ? ` (${a.pet.name})` : ""} · ${getAppointmentLabel(a)}`);
                });
                lines.push("");
              }
              const waUrl = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
              return (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm hidden sm:flex items-center gap-1.5"
                  title="שתף לוח שבוע בוואטסאפ"
                >
                  <Share2 className="w-4 h-4" />
                  סיכום שבוע
                </a>
              );
            })()}
            {/* Day Summary WhatsApp button */}
            {(() => {
              const summaryDate = viewMode === "day" ? selectedDay : new Date();
              const summaryDateStr = toLocalDateString(summaryDate);
              const summaryAppts = filteredAppointments.filter(
                (a) => a.date.slice(0, 10) === summaryDateStr && a.status !== "canceled"
              ).sort((a, b) => a.startTime.localeCompare(b.startTime));
              if (summaryAppts.length === 0) return null;
              const dateLabel = summaryDate.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
              const lines = [
                `📅 תוכנית יום — ${dateLabel}`,
                `סה"כ ${summaryAppts.length} פגישות`,
                "",
                ...summaryAppts.map((a, i) =>
                  `${i + 1}. ${a.startTime} — ${a.customer.name}${a.pet ? ` (${a.pet.name})` : ""} · ${getAppointmentLabel(a)}`
                ),
              ];
              const waUrl = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
              return (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm hidden sm:flex items-center gap-1.5"
                  title="שתף סיכום יום בוואטסאפ"
                >
                  <Share2 className="w-4 h-4" />
                  סיכום יום
                </a>
              );
            })()}
            {isFree && maxAppts !== null && totalApptCount >= maxAppts ? (
              <a href="/upgrade" className="btn-primary text-sm gap-1.5 bg-amber-500 hover:bg-amber-600 border-amber-500 text-white rounded-xl px-3 py-2 font-semibold flex items-center">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">שדרג לבייסיק</span>
                <span className="sm:hidden">שדרג</span>
              </a>
            ) : (
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  setModalDefaults({ date: today, time: "09:00" });
                  setShowNewModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">פגישה חדשה</span>
                <span className="sm:hidden">חדש</span>
              </button>
            )}
          </div>
        </div>

        {/* Free tier appointment limit banner */}
        {isFree && maxAppts !== null && (
          <div className={`flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-xl border ${
            totalApptCount >= maxAppts ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className={`w-4 h-4 flex-shrink-0 ${totalApptCount >= maxAppts ? "text-amber-500" : "text-slate-400"}`} />
              <span className={totalApptCount >= maxAppts ? "text-amber-800" : "text-slate-600"}>
                {totalApptCount}/{maxAppts} פגישות — מגבלת המנוי החינמי
              </span>
            </div>
            {totalApptCount >= maxAppts && (
              <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
                שדרג לבייסיק ←
              </a>
            )}
          </div>
        )}

        {/* Controls row: view toggle + navigation */}
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button onClick={() => navigate(-1)} className="btn-secondary p-2 flex-shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={goToToday} className="btn-secondary text-xs px-3 flex-shrink-0">
            היום
          </button>
          <button onClick={() => navigate(1)} className="btn-secondary p-2 flex-shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* View toggle — hide Week/Month on mobile */}
          <div className="flex items-center bg-white border border-petra-border rounded-xl overflow-hidden ms-auto">
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
                  "px-3 py-2 text-sm font-medium transition-colors",
                  (mode.id === "week" || mode.id === "month") && "hidden md:block",
                  viewMode === mode.id
                    ? "bg-brand-50 text-brand-600"
                    : "text-petra-muted hover:text-petra-text hover:bg-slate-50"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Color Legend / Service Type Filter ── */}
      <div className="hidden md:flex items-center gap-2 flex-wrap mb-4 px-1">
        {/* הכל button */}
        <button
          onClick={() => setServiceTypeFilter(null)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all",
            serviceTypeFilter === null
              ? "border-petra-text font-medium shadow-sm bg-petra-text text-white"
              : "border-petra-border hover:border-petra-text hover:bg-petra-bg text-petra-muted"
          )}
        >
          הכל
        </button>

        {/* Service type filters */}
        {Object.entries(SERVICE_TYPE_COLORS).map(([type, color]) => {
          const isActive = serviceTypeFilter === type;
          const isDimmed = serviceTypeFilter !== null && !isActive;
          return (
            <button
              key={type}
              onClick={() => setServiceTypeFilter(isActive ? null : type)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all",
                isActive
                  ? "border-current font-medium shadow-sm"
                  : isDimmed
                  ? "border-transparent opacity-40 hover:opacity-70"
                  : "border-transparent hover:border-petra-border hover:bg-petra-bg"
              )}
              style={{ color: isActive ? color : undefined }}
              title={`סנן לפי ${SERVICE_TYPE_LABELS[type]}`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span className={isDimmed ? "text-petra-muted line-through" : isActive ? "" : "text-petra-muted"}>
                {SERVICE_TYPE_LABELS[type]}
              </span>
            </button>
          );
        })}

        <div className="w-px h-4 bg-petra-border mx-1" />

        {/* Google Calendar toggle */}
        <button
          onClick={() => setShowGcal((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all",
            showGcal
              ? "border-[#4285F4] font-medium shadow-sm text-[#4285F4]"
              : "border-transparent opacity-40 hover:opacity-70 text-petra-muted"
          )}
          title="הצג/הסתר אירועי יומן גוגל"
        >
          <span className="text-[9px] font-bold bg-[#4285F4] text-white rounded px-1">G</span>
          <span>יומן גוגל</span>
        </button>

        <div className="w-px h-4 bg-petra-border mx-1" />
        <div className="flex items-center gap-1.5 text-xs text-petra-muted px-1">
          <div className="w-2.5 h-2.5 rounded border border-dashed border-orange-400 bg-white" />
          <span>הזמנה</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-petra-muted px-1">
          <div className="w-2.5 h-2.5 rounded border-r-2 border-amber-400 bg-white border border-slate-200" />
          <span>משימה</span>
        </div>
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

              {/* All-day section (boarding stays + all-day tasks) */}
              {(allDayStays.length > 0 || weekAllDayTasks.length > 0) && (
                <div className="border-b border-petra-border bg-slate-50/30">
                  <div className="grid grid-cols-[60px_1fr]">
                    <div className="flex items-center justify-center p-1">
                      <button
                        onClick={() => setAllDayCollapsed((v) => !v)}
                        className="text-[10px] text-petra-muted hover:text-petra-text transition-colors whitespace-nowrap"
                      >
                        {allDayCollapsed ? "▸" : "▾"} כל היום ({allDayStays.length + weekAllDayTasks.length})
                      </button>
                    </div>
                    {!allDayCollapsed && <div className="py-1.5 px-1 space-y-1">
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
                          <a
                            key={stay.id}
                            href="/boarding"
                            className={cn(
                              "h-6 rounded-md text-[10px] font-medium flex items-center gap-1 px-2 truncate border cursor-pointer hover:brightness-95 transition-all",
                              isCheckedIn
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-violet-50 border-violet-200 text-violet-700"
                            )}
                            style={{
                              marginRight: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            title={`${isCheckedIn ? "נמצא בפנסיון" : "הזמנה"}: ${stay.pet.name} · ${stay.room?.name || "ללא חדר"}\nכניסה: ${dateTimeToTime(stay.checkIn)}${stay.checkOut ? ` · יציאה: ${dateTimeToTime(stay.checkOut)}` : ""}`}
                          >
                            <Hotel className="w-3 h-3 flex-shrink-0" />
                            {stay.pet.name} · {stay.room?.name || "ללא חדר"}
                          </a>
                        );
                      })}
                      {weekAllDayTasks.map((task) => {
                        const taskDateStr = task.dueDate!.slice(0, 10);
                        const dayIdx = weekDates.findIndex(
                          (d) => toLocalDateString(d) === taskDateStr
                        );
                        if (dayIdx < 0) return null;
                        const leftPct = (dayIdx / 7) * 100;
                        const widthPct = (1 / 7) * 100;
                        const color = TASK_PRIORITY_COLORS[task.priority] || "#9CA3AF";
                        return (
                          <div
                            key={`task-allday-${task.id}`}
                            className="h-6 rounded-md text-[10px] font-medium flex items-center gap-1 px-2 truncate bg-white border border-slate-200"
                            style={{
                              marginRight: `${leftPct}%`,
                              width: `${widthPct}%`,
                              borderRight: `3px solid ${color}`,
                            }}
                          >
                            <ListTodo className="w-3 h-3 flex-shrink-0 text-petra-muted" />
                            <span className="truncate text-petra-text">{task.title}</span>
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                </div>
              )}

              {/* Time grid */}
              <div className="relative" ref={timeGridRef}>
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
                  const dayAppts = filteredAppointments.filter(
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

                {/* Order blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const dayOrd = orders.filter(
                    (o) => o.startAt && dateTimeToDateStr(o.startAt) === dateStr
                  );
                  return dayOrd.map((order) => {
                    const startTime = dateTimeToTime(order.startAt!);
                    const endTime = order.endAt
                      ? dateTimeToTime(order.endAt)
                      : addMinutes(startTime, 60);
                    const { top, height } = appointmentStyle(startTime, endTime);
                    return renderOrderBlock(
                      order,
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

                {/* Pending online booking blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const dayBookings = pendingBookings.filter(
                    (b) => dateTimeToDateStr(b.startAt) === dateStr
                  );
                  return dayBookings.map((booking) => {
                    const startTime = dateTimeToTime(booking.startAt);
                    const endTime = dateTimeToTime(booking.endAt);
                    const { top, height } = appointmentStyle(startTime, endTime);
                    return renderBookingBlock(
                      booking,
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

                {/* Timed task blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const dayTasks = tasks.filter(
                    (t) => t.dueAt && dateTimeToDateStr(t.dueAt) === dateStr
                  );
                  return dayTasks.map((task) => {
                    const startTime = dateTimeToTime(task.dueAt!);
                    const endTime = addMinutes(startTime, 30);
                    const { top, height } = appointmentStyle(startTime, endTime);
                    return renderTaskBlock(
                      task,
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

                {/* Boarding check-in / check-out timed blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const checkIns = boardingStays.filter(
                    (s) => dateTimeToDateStr(s.checkIn) === dateStr
                  );
                  const checkOuts = boardingStays.filter(
                    (s) => s.checkOut && dateTimeToDateStr(s.checkOut) === dateStr
                  );
                  return [
                    ...checkIns.map((stay) => {
                      const startTime = dateTimeToTime(stay.checkIn);
                      const startMins = timeToMinutes(startTime);
                      if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                      const endTime = addMinutes(startTime, 30);
                      const { top, height } = appointmentStyle(startTime, endTime);
                      return (
                        <a
                          key={`checkin-${stay.id}`}
                          href="/boarding"
                          className="absolute rounded-lg px-1.5 py-0.5 overflow-hidden transition-all hover:brightness-95 border border-emerald-300 flex flex-col justify-center"
                          style={{
                            top,
                            height: Math.max(height, 22),
                            right: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                            width: `calc((100% - 60px) / 7 - 4px)`,
                            marginRight: 2,
                            background: "#D1FAE5",
                            zIndex: 8,
                          }}
                          title={`צ׳ק-אין: ${stay.pet.name} — ${stay.customer.name}${stay.room ? ` · ${stay.room.name}` : ""} (${startTime})`}
                        >
                          <div className="text-[10px] font-semibold text-emerald-800 truncate flex items-center gap-0.5">
                            <Hotel className="w-2.5 h-2.5 flex-shrink-0" />↓ {stay.pet.name}
                          </div>
                          {Math.max(height, 22) > 32 && (
                            <div className="text-[9px] text-emerald-700 truncate">{stay.customer.name}</div>
                          )}
                        </a>
                      );
                    }),
                    ...checkOuts.map((stay) => {
                      const startTime = dateTimeToTime(stay.checkOut!);
                      const startMins = timeToMinutes(startTime);
                      if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                      const endTime = addMinutes(startTime, 30);
                      const { top, height } = appointmentStyle(startTime, endTime);
                      return (
                        <a
                          key={`checkout-${stay.id}`}
                          href="/boarding"
                          className="absolute rounded-lg px-1.5 py-0.5 overflow-hidden transition-all hover:brightness-95 border border-amber-300 flex flex-col justify-center"
                          style={{
                            top,
                            height: Math.max(height, 22),
                            right: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                            width: `calc((100% - 60px) / 7 - 4px)`,
                            marginRight: 2,
                            background: "#FEF3C7",
                            zIndex: 8,
                          }}
                          title={`צ׳ק-אאוט: ${stay.pet.name} — ${stay.customer.name}${stay.room ? ` · ${stay.room.name}` : ""} (${startTime})`}
                        >
                          <div className="text-[10px] font-semibold text-amber-800 truncate flex items-center gap-0.5">
                            <Hotel className="w-2.5 h-2.5 flex-shrink-0" />↑ {stay.pet.name}
                          </div>
                          {Math.max(height, 22) > 32 && (
                            <div className="text-[9px] text-amber-700 truncate">{stay.customer.name}</div>
                          )}
                        </a>
                      );
                    }),
                  ];
                })}

                {/* Google Calendar external events overlay (read-only) */}
                {showGcal && gcalEvents.filter((e) => !e.isAllDay).map((ev) => {
                  const startStr = ev.start.slice(0, 10);
                  const dayIdx = weekDates.findIndex((d) => toLocalDateString(d) === startStr);
                  if (dayIdx === -1) return null;
                  const startTime = dateTimeToTime(ev.start);
                  const endTime = dateTimeToTime(ev.end);
                  const { top, height } = appointmentStyle(startTime, endTime);
                  const startMins = timeToMinutes(startTime);
                  if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                  return (
                    <a
                      key={ev.id}
                      href={ev.htmlLink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${ev.title}\n${ev.calendarName}\n${startTime}–${endTime}`}
                      className="absolute rounded-lg px-1.5 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity"
                      style={{
                        top,
                        height: Math.max(height, 20),
                        right: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        marginRight: 2,
                        background: ev.backgroundColor,
                        borderColor: ev.backgroundColor,
                        zIndex: 5,
                      }}
                    >
                      <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-white/80 rounded px-0.5" style={{ color: ev.backgroundColor }}>G</span>
                      <div className="text-[10px] font-semibold truncate text-white drop-shadow-sm">
                        {ev.title}
                      </div>
                    </a>
                  );
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
          {/* All-day section (boarding stays + all-day tasks) */}
          {(allDayStays.length > 0 || dayAllDayTasks.length > 0) && (
            <div className="border-b border-petra-border bg-slate-50/30 p-3">
              <button
                onClick={() => setAllDayCollapsed((v) => !v)}
                className="text-[10px] text-petra-muted font-medium mb-1.5 hover:text-petra-text transition-colors"
              >
                {allDayCollapsed ? "▸" : "▾"} כל היום ({allDayStays.length + dayAllDayTasks.length})
              </button>
              {!allDayCollapsed && <div className="space-y-1">
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
                {dayAllDayTasks.map((task) => {
                  const color = TASK_PRIORITY_COLORS[task.priority] || "#9CA3AF";
                  return (
                    <div
                      key={`task-allday-${task.id}`}
                      className="h-7 rounded-lg text-xs font-medium flex items-center gap-1.5 px-3 bg-white border border-slate-200"
                      style={{ borderRight: `3px solid ${color}` }}
                    >
                      <ListTodo className="w-3.5 h-3.5 flex-shrink-0 text-petra-muted" />
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="truncate text-petra-text">{task.title}</span>
                      <span className="text-petra-muted ms-auto">
                        {TASK_CATEGORY_LABELS[task.category] || task.category}
                      </span>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Time grid */}
          <div className="relative" ref={timeGridRef}>
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

            {/* Order blocks */}
            {dayOrders.map((order) => {
              const startTime = dateTimeToTime(order.startAt!);
              const endTime = order.endAt
                ? dateTimeToTime(order.endAt)
                : addMinutes(startTime, 60);
              const { top, height } = appointmentStyle(startTime, endTime);
              return renderOrderBlock(
                order,
                {
                  top,
                  height,
                  right: 60,
                  width: "calc(100% - 64px)",
                },
                false
              );
            })}

            {/* Timed task blocks */}
            {dayTimedTasks.map((task) => {
              const startTime = dateTimeToTime(task.dueAt!);
              const endTime = addMinutes(startTime, 30);
              const { top, height } = appointmentStyle(startTime, endTime);
              return renderTaskBlock(
                task,
                {
                  top,
                  height,
                  right: 60,
                  width: "calc(100% - 64px)",
                },
                false
              );
            })}

            {/* Pending online booking blocks - day view */}
            {pendingBookings
              .filter((b) => dateTimeToDateStr(b.startAt) === toLocalDateString(selectedDay))
              .map((booking) => {
                const startTime = dateTimeToTime(booking.startAt);
                const endTime = dateTimeToTime(booking.endAt);
                const { top, height } = appointmentStyle(startTime, endTime);
                return renderBookingBlock(
                  booking,
                  { top, height, right: 60, width: "calc(100% - 64px)" },
                  false
                );
              })}

            {/* Google Calendar external events overlay - day view */}
            {showGcal && gcalEvents.filter((e) => !e.isAllDay && e.start.slice(0, 10) === toLocalDateString(selectedDay)).map((ev) => {
              const startTime = dateTimeToTime(ev.start);
              const endTime = dateTimeToTime(ev.end);
              const { top, height } = appointmentStyle(startTime, endTime);
              const startMins = timeToMinutes(startTime);
              if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
              return (
                <a
                  key={ev.id}
                  href={ev.htmlLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${ev.title}\n${ev.calendarName}\n${startTime}–${endTime}`}
                  className="absolute rounded-lg px-2 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity"
                  style={{
                    top,
                    height: Math.max(height, 22),
                    right: 60,
                    width: "calc(100% - 64px)",
                    background: ev.backgroundColor,
                    borderColor: ev.backgroundColor,
                    zIndex: 5,
                  }}
                >
                  <span className="absolute top-0.5 left-0.5 text-[8px] font-bold bg-white/80 rounded px-0.5" style={{ color: ev.backgroundColor }}>G</span>
                  <div className="text-xs font-semibold truncate text-white drop-shadow-sm">
                    {ev.title}
                  </div>
                  <div className="text-[10px] truncate text-white/80">
                    {ev.calendarName}
                  </div>
                </a>
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
              const dayAppts = filteredAppointments.filter(
                (a) => a.date.slice(0, 10) === dateStr
              );
              const dayOrd = orders.filter(
                (o) => o.startAt && dateTimeToDateStr(o.startAt) === dateStr
              );
              const dayTsk = tasks.filter(
                (t) =>
                  (t.dueAt && dateTimeToDateStr(t.dueAt) === dateStr) ||
                  (!t.dueAt && t.dueDate && t.dueDate.slice(0, 10) === dateStr)
              );

              // Build a combined list of event entries for display
              type MonthEntry = { key: string; color: string; label: string; onClick?: (e: React.MouseEvent) => void };
              const entries: MonthEntry[] = [];
              dayAppts.forEach((apt) => {
                entries.push({
                  key: `apt-${apt.id}`,
                  color: getAppointmentColor(apt.service, apt.priceListItem),
                  label: `${apt.startTime} ${apt.customer.name}`,
                  onClick: (e) => { e.stopPropagation(); setSelectedAppointment(apt); },
                });
              });
              dayOrd.forEach((order) => {
                const time = dateTimeToTime(order.startAt!);
                entries.push({
                  key: `ord-${order.id}`,
                  color: ORDER_TYPE_COLORS[order.orderType] || "#F97316",
                  label: `${time} ${order.customer.name} ₪${order.total}`,
                });
              });
              dayTsk.forEach((task) => {
                const time = task.dueAt ? dateTimeToTime(task.dueAt) : "";
                entries.push({
                  key: `tsk-${task.id}`,
                  color: TASK_PRIORITY_COLORS[task.priority] || "#9CA3AF",
                  label: `${time ? time + " " : ""}${task.title}`,
                });
              });
              // Add GCal events to month view
              const dayGcal = gcalEvents.filter((e) => !e.isAllDay && e.start.slice(0, 10) === dateStr);
              dayGcal.forEach((ev) => {
                const time = dateTimeToTime(ev.start);
                entries.push({
                  key: `gcal-${ev.id}`,
                  color: ev.backgroundColor,
                  label: `${time} ${ev.title}`,
                });
              });

              const shown = entries.slice(0, 3);
              const overflow = entries.length - 3;

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
                      {shown.map((entry) => (
                        <div
                          key={entry.key}
                          className="flex items-center gap-1 text-[10px] truncate"
                          onClick={entry.onClick}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: entry.color }}
                          />
                          <span
                            className={cn(
                              "truncate",
                              isCurrentMonth
                                ? "text-petra-text"
                                : "text-petra-muted/40"
                            )}
                          >
                            {entry.label}
                          </span>
                        </div>
                      ))}
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
            onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setCancellationNote(""); setEditingNotes(false); }}
          />
          <div className="modal-content max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <a
                  href={`/customers/${selectedAppointment.customer.id}`}
                  className="text-lg font-bold text-petra-text hover:text-brand-600 transition-colors"
                  onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setCancellationNote(""); setEditingNotes(false); }}
                >
                  {selectedAppointment.customer.name}
                </a>
                <p className="text-xs text-petra-muted mt-0.5">
                  {new Date(selectedAppointment.date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <button
                onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setCancellationNote(""); setEditingNotes(false); }}
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
                {getAppointmentLabel(selectedAppointment)}
              </div>
              {/* Notes section with inline edit */}
              <div className="group/notes">
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      className="input text-xs resize-none"
                      rows={3}
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="הוסף הערות לתור..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1"
                        disabled={notesMutation.isPending}
                        onClick={() => notesMutation.mutate({ id: selectedAppointment.id, notes: notesInput })}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {notesMutation.isPending ? "שומר..." : "שמור הערות"}
                      </button>
                      <button
                        className="btn-secondary text-xs py-1.5 px-3"
                        onClick={() => { setEditingNotes(false); setNotesInput(selectedAppointment.notes ?? ""); }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    {selectedAppointment.notes ? (
                      <p className="text-petra-muted flex-1">{selectedAppointment.notes}</p>
                    ) : (
                      <p className="text-petra-muted/50 text-xs italic flex-1">אין הערות</p>
                    )}
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-brand-500 hover:bg-slate-100 transition-colors flex-shrink-0 opacity-0 group-hover/notes:opacity-100"
                      title="ערוך הערות"
                      onClick={() => { setNotesInput(selectedAppointment.notes ?? ""); setEditingNotes(true); }}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
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
            {/* Cancellation note */}
            {selectedAppointment.status === "canceled" && selectedAppointment.cancellationNote && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <p className="text-xs font-medium text-red-600 mb-0.5">סיבת ביטול</p>
                <p className="text-xs text-red-700">{selectedAppointment.cancellationNote}</p>
              </div>
            )}
            {/* WhatsApp reminder */}
            <a
              href={(() => {
                const appt = selectedAppointment;
                const date = new Date(appt.date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
                const msg = `שלום ${appt.customer.name}! 😊\nתזכורת לתור שלך:\n📅 ${date} בשעה ${appt.startTime}\n🐾 ${getAppointmentLabel(appt)}${appt.pet ? ` עם ${appt.pet.name}` : ""}\n\nנתראה! 🌟`;
                return `https://wa.me/${toWhatsAppPhone(appt.customer.phone)}?text=${encodeURIComponent(msg)}`;
              })()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              שלח תזכורת בוואטסאפ
            </a>

            {/* Reschedule form */}
            {rescheduling && (
              <div className="mt-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-3">
                <p className="text-xs font-semibold text-brand-700">העבר תור</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-[10px]">תאריך</label>
                    <input
                      type="date" lang="he"
                      className="input text-xs py-1.5"
                      value={rescheduleForm.date}
                      onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">שעת התחלה</label>
                    <input
                      type="time"
                      className="input text-xs py-1.5"
                      value={rescheduleForm.startTime}
                      onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1 text-xs"
                    disabled={rescheduleMutation.isPending || !rescheduleForm.date || !rescheduleForm.startTime}
                    onClick={() =>
                      rescheduleMutation.mutate({
                        id: selectedAppointment.id,
                        date: rescheduleForm.date,
                        startTime: rescheduleForm.startTime,
                        endTime: rescheduleForm.endTime || rescheduleForm.startTime,
                      })
                    }
                  >
                    {rescheduleMutation.isPending ? "שומר..." : "אשר העברה"}
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => setRescheduling(false)}>ביטול</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              {confirmDeleteId === selectedAppointment.id ? (
                <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-red-700 flex-1">למחוק את התור לצמיתות?</span>
                  <button
                    className="text-xs font-semibold text-red-600 hover:text-red-800"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selectedAppointment.id)}
                  >
                    {deleteMutation.isPending ? "..." : "כן, מחק"}
                  </button>
                  <button
                    className="text-xs text-petra-muted hover:text-petra-text"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    לא
                  </button>
                </div>
              ) : confirmCancelId === selectedAppointment.id ? (
                <div className="flex-1 flex flex-col gap-2 bg-red-50 rounded-xl px-3 py-2">
                  <span className="text-xs font-semibold text-red-700">לבטל את התור?</span>
                  <input
                    type="text"
                    className="input text-xs py-1"
                    placeholder="סיבת ביטול (אופציונלי)"
                    value={cancellationNote}
                    onChange={(e) => setCancellationNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="text-xs font-semibold text-red-600 hover:text-red-800"
                      disabled={statusMutation.isPending}
                      onClick={() => {
                        statusMutation.mutate({ id: selectedAppointment.id, status: "canceled", cancellationNote: cancellationNote.trim() || undefined });
                        setConfirmCancelId(null);
                        setCancellationNote("");
                      }}
                    >
                      כן, בטל
                    </button>
                    <button
                      className="text-xs text-petra-muted hover:text-petra-text"
                      onClick={() => { setConfirmCancelId(null); setCancellationNote(""); }}
                    >
                      לא
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selectedAppointment.status === "scheduled" && selectedAppointment.customer.phone && can("whatsapp_reminders") && (
                    <button
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 border border-transparent hover:border-green-200 transition-colors flex-shrink-0"
                      disabled={remindMutation.isPending}
                      onClick={() => remindMutation.mutate(selectedAppointment.id)}
                      title="שלח תזכורת WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                  {selectedAppointment.status === "scheduled" && (
                    <button
                      className="btn-primary flex-1 text-xs"
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        statusMutation.mutate({
                          id: selectedAppointment.id,
                          status: "completed",
                        })
                      }
                    >
                      הושלם
                    </button>
                  )}
                  {selectedAppointment.status === "scheduled" && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => {
                        const d = new Date(selectedAppointment.date);
                        const dateStr = d.toISOString().slice(0, 10);
                        setRescheduleForm({ date: dateStr, startTime: selectedAppointment.startTime, endTime: selectedAppointment.endTime });
                        setRescheduling(true);
                      }}
                      title="העבר תור"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {selectedAppointment.status === "scheduled" && (
                    <button
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-amber-500 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors flex-shrink-0"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: "no_show" })}
                      title="לא הגיע"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                  {selectedAppointment.status === "scheduled" && (
                    <button
                      className="btn-danger flex-1 text-xs"
                      onClick={() => setConfirmCancelId(selectedAppointment.id)}
                    >
                      בטל תור
                    </button>
                  )}
                  {selectedAppointment.status === "completed" && (
                    <>
                      <button
                        className="btn-secondary flex-1 text-xs"
                        onClick={() => setShowQuickPayment(true)}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        הוסף תשלום
                      </button>
                      {selectedAppointment.customer.phone && (
                        <a
                          href={(() => {
                            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
                            const bookingUrl = `${baseUrl}/book/${user?.businessSlug || user?.businessId || ""}`;
                            const msg = `שלום ${selectedAppointment.customer.name}! 😊\nתודה על הביקור! מוזמנ/ת לקבוע את התור הבא:\n${bookingUrl}\nנתראה! 🐾`;
                            return `https://wa.me/${toWhatsAppPhone(selectedAppointment.customer.phone)}?text=${encodeURIComponent(msg)}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 border border-transparent hover:border-green-200 transition-colors flex-shrink-0"
                          title="שלח לינק לתור הבא"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </>
                  )}
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors flex-shrink-0"
                    onClick={() => setConfirmDeleteId(selectedAppointment.id)}
                    title="מחק תור"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showQuickPayment && selectedAppointment && (
        <QuickPaymentModal
          appointment={selectedAppointment}
          onClose={() => setShowQuickPayment(false)}
        />
      )}

      <NewAppointmentModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        defaultDate={modalDefaults.date}
        defaultTime={modalDefaults.time}
        existingAppointments={filteredAppointments}
      />
    </div>
  );
}
