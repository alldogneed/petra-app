"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  PawPrint,
  Calendar,
  X,
  Pencil,
  Crown,
  Check,
  Clock,
  ChevronDown,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  MinusSquare,
  ShoppingCart,
  GraduationCap,
  Hotel,
  Scissors,
  Package,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { toWhatsAppPhone, fetchJSON, formatCurrency } from "@/lib/utils";
import { SERVICE_TYPES, ORDER_CATEGORIES, ORDER_UNITS } from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────────────

interface PetInfo {
  id: string;
  name: string;
  species: string;
  breed: string | null;
}

interface AppointmentInfo {
  date: string;
  startTime: string;
  serviceName: string;
}

interface FinancialInfo {
  totalPaid: number;
  totalPending: number;
  hasDeposits: boolean;
}

interface EnhancedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  tags: string;
  source: string | null;
  createdAt: string;
  pets: PetInfo[];
  _count: { pets: number; appointments: number };
  status: "active" | "dormant" | "vip";
  lastAppointment: AppointmentInfo | null;
  nextAppointment: AppointmentInfo | null;
  financial: FinancialInfo;
  serviceTypes: string[];
}

interface ServiceOption {
  id: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  color: string | null;
}

// ─── Helper Functions ───────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function parseTags(tagsStr: string): string[] {
  try {
    return JSON.parse(tagsStr);
  } catch {
    return [];
  }
}

// ─── Customer Tag & Source Constants ────────────────────────────

const CUSTOMER_PRESET_TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"];

const REFERRAL_SOURCES = [
  { value: "referral", label: "המלצה מלקוח" },
  { value: "google", label: "גוגל" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "facebook", label: "פייסבוק" },
  { value: "tiktok", label: "טיקטוק" },
  { value: "signage", label: "שלט / מעבר ברחוב" },
  { value: "other", label: "אחר" },
];

// Generate time slots from 08:00 to 20:00 in 30-min intervals
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

// ─── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "vip":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Crown className="w-3 h-3" />
          VIP
        </span>
      );
    case "active":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          פעיל
        </span>
      );
    case "dormant":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          רדום
        </span>
      );
    default:
      return null;
  }
}

// ─── Financial Badge ────────────────────────────────────────────

function FinancialBadge({ financial }: { financial: FinancialInfo }) {
  if (financial.totalPending > 0) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
          חוב
        </span>
        <span className="text-xs font-bold text-red-600 mr-1">
          ₪{financial.totalPending.toLocaleString()}
        </span>
      </div>
    );
  }
  if (financial.hasDeposits) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
        <Sparkles className="w-3 h-3" />
        קרדיט
      </span>
    );
  }
  if (financial.totalPaid > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
        <Check className="w-3 h-3" />
        מאוזן
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

// ─── Pets Cell ──────────────────────────────────────────────────

function PetsCell({ pets, count }: { pets: PetInfo[]; count: number }) {
  if (count === 0) {
    return <span className="text-xs text-slate-400">אין חיות</span>;
  }
  const primary = pets[0];
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-[#FEF3E2] flex items-center justify-center flex-shrink-0">
        <PawPrint className="w-3.5 h-3.5 text-[#C4956A]" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-petra-text truncate max-w-[160px]">
          {primary.name}
          {primary.breed && (
            <span className="text-petra-muted font-normal text-xs">
              {" "}
              — {primary.breed}
            </span>
          )}
        </div>
        {count > 1 && (
          <span className="text-[10px] text-[#A0845C] font-medium">
            +{count - 1} נוספים
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Appointment Dates Cell ─────────────────────────────────────

function AppointmentDates({
  last,
  next,
}: {
  last: AppointmentInfo | null;
  next: AppointmentInfo | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className="text-[11px] text-petra-muted">
          {last ? <>אחרון: {formatShortDate(last.date)}</> : "אין היסטוריה"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3 h-3 text-brand-500 flex-shrink-0" />
        <span
          className={`text-[11px] font-medium ${next ? "text-petra-text" : "text-slate-400"}`}
        >
          {next ? <>הבא: {formatShortDate(next.date)}</> : "לא נקבע"}
        </span>
      </div>
    </div>
  );
}

// ─── WhatsApp Icon (official logo SVG) ─────────────────────────

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ─── Quick Actions ──────────────────────────────────────────────

function QuickActions({
  customer,
  onEdit,
  onBook,
}: {
  customer: EnhancedCustomer;
  onEdit: () => void;
  onBook: () => void;
}) {
  const waPhone = toWhatsAppPhone(customer.phone);

  return (
    <div className="flex items-center gap-1">
      {/* WhatsApp — with official logo */}
      <a
        href={`https://wa.me/${waPhone}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#25D366] hover:bg-[#E8FEF0] transition-colors"
        title="שלח הודעת WhatsApp"
        onClick={(e) => e.stopPropagation()}
      >
        <WhatsAppIcon className="w-4 h-4" />
      </a>

      {/* Email — only when customer has an email address */}
      {customer.email ? (
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
          title={`שלח אימייל ל־${customer.email}`}
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `mailto:${customer.email}`;
          }}
        >
          <Mail className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-8 h-8" />
      )}

      {/* Quick book */}
      <button
        className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-500 hover:bg-brand-50 transition-colors"
        title="קביעת תור מהיר"
        onClick={(e) => {
          e.stopPropagation();
          onBook();
        }}
      >
        <Calendar className="w-4 h-4" />
      </button>

      {/* Edit */}
      <button
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        title="עריכת לקוח"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Filter Pill Button ─────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
        active
          ? "bg-[#3D2E1F] text-white shadow-sm"
          : "bg-[#FAF7F3] text-[#8B7355] border border-[#E8DFD5] hover:bg-[#F3EDE6] hover:border-[#D4C5B2]"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            active ? "bg-white/20 text-white" : "bg-[#E8DFD5] text-[#8B7355]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Edit Customer Modal ────────────────────────────────────────

function EditCustomerModal({
  isOpen,
  onClose,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: EnhancedCustomer | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    selectedTags: [] as string[],
    source: "",
  });

  // Sync form when customer changes
  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        address: customer.address || "",
        notes: customer.notes || "",
        selectedTags: parseTags(customer.tags),
        source: customer.source || "",
      });
    }
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleEditTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/customers/${customer?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
          tags: JSON.stringify(data.selectedTags),
          source: data.source || null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
  });

  if (!isOpen || !customer) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">עריכת לקוח</h2>
            <p className="text-sm text-petra-muted mt-0.5">{customer.name}</p>
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
            <label className="label">שם מלא *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">תגיות לקוח</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CUSTOMER_PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleEditTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    form.selectedTags.includes(tag)
                      ? tag === "VIP"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-[#3D2E1F] text-white border-[#3D2E1F]"
                      : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">מקור הגעה</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="">— לא ידוע —</option>
              {REFERRAL_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Book Modal ───────────────────────────────────────────

function QuickBookModal({
  isOpen,
  onClose,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: EnhancedCustomer | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    serviceId: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    petId: "",
    notes: "",
  });

  const { data: services = [] } = useQuery<ServiceOption[]>({
    queryKey: ["services"],
    queryFn: () => fetchJSON<ServiceOption[]>("/api/services"),
    enabled: isOpen,
  });

  const selectedService = services.find((s) => s.id === form.serviceId);

  const mutation = useMutation({
    mutationFn: (data: {
      serviceId: string;
      date: string;
      startTime: string;
      endTime: string;
      customerId: string;
      petId?: string;
      notes?: string;
    }) =>
      fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
      setForm({
        serviceId: "",
        date: new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        petId: "",
        notes: "",
      });
    },
  });

  const handleSubmit = () => {
    if (!customer || !form.serviceId || !form.date || !form.startTime) return;
    const duration = selectedService?.duration || 60;
    const endTime = computeEndTime(form.startTime, duration);
    mutation.mutate({
      serviceId: form.serviceId,
      date: form.date,
      startTime: form.startTime,
      endTime,
      customerId: customer.id,
      petId: form.petId || undefined,
      notes: form.notes || undefined,
    });
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">קביעת תור מהיר</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              עבור {customer.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Service */}
          <div>
            <label className="label">שירות *</label>
            <select
              className="input"
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            >
              <option value="">בחר שירות</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration} דק&apos; — ₪{s.price})
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
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
              <select
                className="input"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Display end time */}
          {selectedService && (
            <div className="flex items-center gap-2 text-xs text-petra-muted bg-[#FAF7F3] px-3 py-2 rounded-lg border border-[#E8DFD5]">
              <Clock className="w-3.5 h-3.5" />
              <span>
                משך: {selectedService.duration} דקות | סיום:{" "}
                {computeEndTime(form.startTime, selectedService.duration)}
              </span>
            </div>
          )}

          {/* Pet (optional) */}
          {customer.pets.length > 0 && (
            <div>
              <label className="label">חיה (אופציונלי)</label>
              <select
                className="input"
                value={form.petId}
                onChange={(e) => setForm({ ...form, petId: e.target.value })}
              >
                <option value="">ללא בחירה</option>
                {customer.pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.breed ? ` (${p.breed})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="הערות לתור..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={
              !form.serviceId ||
              !form.date ||
              !form.startTime ||
              mutation.isPending
            }
            onClick={handleSubmit}
          >
            <Calendar className="w-4 h-4" />
            {mutation.isPending ? "קובע..." : "קבע תור"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Customer Modal ─────────────────────────────────────────

function NewCustomerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    selectedTags: [] as string[],
    source: "",
  });

  const toggleNewTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));
  };

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          notes: data.notes || null,
          tags: JSON.stringify(data.selectedTags),
          source: data.source || null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      setForm({ name: "", phone: "", email: "", notes: "", selectedTags: [], source: "" });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">לקוח חדש</h2>
            <p className="text-sm text-petra-muted mt-0.5">הוסף לקוח למערכת</p>
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
            <label className="label">שם מלא *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="שם הלקוח"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-0000000"
              />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">תגיות לקוח</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CUSTOMER_PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleNewTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    form.selectedTags.includes(tag)
                      ? tag === "VIP"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-[#3D2E1F] text-white border-[#3D2E1F]"
                      : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">מקור הגעה</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="">— לא ידוע —</option>
              {REFERRAL_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? "שומר..." : "הוסף לקוח"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Order Modal (3-step wizard) ─────────────────────────────

interface PriceListItemOption {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  basePrice: number;
  description: string | null;
  defaultQuantity: number;
}

const CATEGORY_ICONS: Record<string, typeof GraduationCap> = {
  training: GraduationCap,
  boarding: Hotel,
  grooming: Scissors,
  products: Package,
};

const CATEGORY_COLORS: Record<string, string> = {
  training: "from-blue-500 to-blue-600",
  boarding: "from-purple-500 to-purple-600",
  grooming: "from-pink-500 to-pink-600",
  products: "from-emerald-500 to-emerald-600",
};

function NewOrderModal({
  isOpen,
  onClose,
  customers,
}: {
  isOpen: boolean;
  onClose: () => void;
  customers: EnhancedCustomer[];
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [form, setForm] = useState({
    customerId: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    notes: "",
    sendReminder: true,
  });
  const [lines, setLines] = useState<
    { priceListItemId?: string; name: string; unit: string; quantity: number; unitPrice: number }[]
  >([]);

  // Fetch price list items for chosen category
  const { data: priceItems = [] } = useQuery<PriceListItemOption[]>({
    queryKey: ["priceListItems", category],
    queryFn: () => fetchJSON<PriceListItemOption[]>(`/api/price-list-items?category=${category}`),
    enabled: !!category && step >= 2,
  });

  const selectedCustomer = customers.find((c) => c.id === form.customerId);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20);
    const q = customerSearch.toLowerCase();
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 20);
  }, [customers, customerSearch]);

  const orderTotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  const resetAndClose = useCallback(() => {
    setStep(1);
    setCategory("");
    setCustomerSearch("");
    setForm({ customerId: "", date: new Date().toISOString().slice(0, 10), time: "09:00", notes: "", sendReminder: true });
    setLines([]);
    onClose();
  }, [onClose]);

  const addLine = (item: PriceListItemOption) => {
    // Don't add duplicates
    if (lines.some((l) => l.priceListItemId === item.id)) return;
    setLines((prev) => [
      ...prev,
      {
        priceListItemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: item.defaultQuantity,
        unitPrice: item.basePrice,
      },
    ]);
  };

  const addManualLine = () => {
    setLines((prev) => [
      ...prev,
      { name: "", unit: "per_unit", quantity: 1, unitPrice: 0 },
    ]);
  };

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const mutation = useMutation({
    mutationFn: (data: {
      customerId: string;
      orderType: string;
      startAt: string | null;
      lines: typeof lines;
      notes: string;
      status: string;
      sendReminder: boolean;
    }) =>
      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      resetAndClose();
    },
  });

  const handleSubmit = () => {
    if (!form.customerId || lines.length === 0) return;
    const startAt =
      form.date && form.time
        ? new Date(`${form.date}T${form.time}:00`).toISOString()
        : null;
    mutation.mutate({
      customerId: form.customerId,
      orderType: category || "sale",
      startAt,
      lines: lines.map((l) => ({
        ...l,
        taxMode: "taxable" as const,
      })),
      notes: form.notes,
      status: "pending",
      sendReminder: form.sendReminder,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={resetAndClose} />
      <div className="modal-content max-w-xl mx-4 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-petra-text">הזמנה חדשה</h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step
                      ? "w-8 bg-gradient-to-l from-[#f38d49] to-[#FB923C]"
                      : s < step
                      ? "w-6 bg-[#f38d49]/40"
                      : "w-6 bg-slate-200"
                  }`}
                />
              ))}
              <span className="text-xs text-petra-muted mr-2">
                {step === 1 ? "בחירת קטגוריה" : step === 2 ? "פרטי הזמנה" : "אישור"}
              </span>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {/* ─── Step 1: Category ─── */}
          {step === 1 && (
            <div>
              <p className="text-sm text-petra-muted mb-4">בחר את סוג ההזמנה:</p>
              <div className="grid grid-cols-2 gap-3">
                {ORDER_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.id] || Package;
                  const colorClass = CATEGORY_COLORS[cat.id] || "from-orange-500 to-orange-600";
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        setStep(2);
                      }}
                      className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-100 hover:border-[#f38d49]/40 hover:shadow-md transition-all"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-petra-text">
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Step 2: Details ─── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Customer search */}
              <div>
                <label className="label">לקוח *</label>
                {!form.customerId ? (
                  <div>
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
                      <input
                        className="input pr-9"
                        placeholder="חפש לפי שם או טלפון..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-2 max-h-36 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setForm({ ...form, customerId: c.id })}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-[#FAF7F3] transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f38d49] to-[#FB923C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {c.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-petra-text truncate">
                              {c.name}
                            </div>
                            <div className="text-xs text-petra-muted">{c.phone}</div>
                          </div>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="px-3 py-4 text-center text-sm text-petra-muted">
                          לא נמצאו לקוחות
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-[#FAF7F3] rounded-lg border border-[#E8DFD5]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f38d49] to-[#FB923C] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {selectedCustomer?.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-petra-text">
                        {selectedCustomer?.name}
                      </div>
                      <div className="text-xs text-petra-muted">
                        {selectedCustomer?.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => setForm({ ...form, customerId: "" })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white text-petra-muted"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Price list items */}
              <div>
                <label className="label">פריטים</label>
                {priceItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
                    {priceItems.map((item) => {
                      const added = lines.some((l) => l.priceListItemId === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => addLine(item)}
                          disabled={added}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            added
                              ? "bg-[#f38d49]/10 text-[#f38d49] border-[#f38d49]/20 cursor-default"
                              : "bg-white text-petra-text border-slate-200 hover:border-[#f38d49]/40 hover:bg-[#FFF8F3]"
                          }`}
                        >
                          {added && <Check className="w-3 h-3" />}
                          {item.name} — {formatCurrency(item.basePrice)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Added lines */}
                {lines.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-100"
                      >
                        <div className="flex-1 min-w-0 space-y-2">
                          {!line.priceListItemId ? (
                            <input
                              className="input text-sm"
                              placeholder="שם הפריט..."
                              value={line.name}
                              onChange={(e) => updateLine(idx, "name", e.target.value)}
                            />
                          ) : (
                            <div className="text-sm font-medium text-petra-text truncate">
                              {line.name}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-petra-muted">כמות:</label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                className="input w-16 text-sm text-center py-1"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateLine(idx, "quantity", Math.max(1, Number(e.target.value)))
                                }
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-petra-muted">מחיר:</label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="input w-20 text-sm text-center py-1"
                                value={line.unitPrice}
                                onChange={(e) =>
                                  updateLine(idx, "unitPrice", Math.max(0, Number(e.target.value)))
                                }
                              />
                            </div>
                            <select
                              className="input text-xs py-1 w-auto"
                              value={line.unit}
                              onChange={(e) => updateLine(idx, "unit", e.target.value)}
                            >
                              {ORDER_UNITS.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.label}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs font-semibold text-petra-text mr-auto">
                              {formatCurrency(line.quantity * line.unitPrice)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLine(idx)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={addManualLine}
                  className="text-xs text-[#f38d49] hover:text-[#e07a3a] font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף פריט ידני
                </button>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך</label>
                  <input
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">שעה</label>
                  <select
                    className="input"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">הערות</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="הערות להזמנה..."
                />
              </div>
            </div>
          )}

          {/* ─── Step 3: Confirm ─── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="p-4 bg-[#FAF7F3] rounded-xl border border-[#E8DFD5]">
                <div className="flex items-center gap-3 mb-4">
                  {(() => {
                    const CatIcon = CATEGORY_ICONS[category] || Package;
                    const catLabel = ORDER_CATEGORIES.find((c) => c.id === category)?.label || category;
                    return (
                      <>
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${CATEGORY_COLORS[category] || "from-orange-500 to-orange-600"} flex items-center justify-center`}>
                          <CatIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-petra-text">{catLabel}</div>
                          <div className="text-xs text-petra-muted">
                            {selectedCustomer?.name} • {form.date} {form.time}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="divide-y divide-[#E8DFD5]">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2">
                      <div>
                        <span className="text-sm text-petra-text">{line.name}</span>
                        <span className="text-xs text-petra-muted mr-2">
                          × {line.quantity}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-petra-text">
                        {formatCurrency(line.quantity * line.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#D4C5B2]">
                  <span className="text-sm font-bold text-petra-text">סה&quot;כ</span>
                  <span className="text-lg font-bold text-[#f38d49]">
                    {formatCurrency(orderTotal)}
                  </span>
                </div>
              </div>

              {/* WhatsApp reminder toggle */}
              <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100 cursor-pointer hover:border-[#25D366]/30 transition-colors">
                <input
                  type="checkbox"
                  checked={form.sendReminder}
                  onChange={(e) =>
                    setForm({ ...form, sendReminder: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-[#25D366] focus:ring-[#25D366]/20"
                />
                <MessageCircle className="w-5 h-5 text-[#25D366] flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-petra-text">
                    שלח תזכורת WhatsApp
                  </div>
                  <div className="text-xs text-petra-muted">
                    תזכורת אוטומטית 48 שעות לפני מועד ההזמנה
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {step > 1 && (
            <button
              className="btn-ghost flex items-center gap-1.5"
              onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
            >
              <ArrowRight className="w-4 h-4" />
              חזרה
            </button>
          )}
          <div className="flex-1" />
          {step === 2 && (
            <button
              className="btn-primary flex items-center gap-1.5"
              disabled={!form.customerId || lines.length === 0}
              onClick={() => setStep(3)}
            >
              המשך
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {step === 3 && (
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm shadow-sm transition-all hover:shadow-md disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #f38d49, #FB923C)",
              }}
              disabled={mutation.isPending}
              onClick={handleSubmit}
            >
              <ShoppingCart className="w-4 h-4" />
              {mutation.isPending ? "שומר..." : "צור הזמנה"}
            </button>
          )}
          <button className="btn-secondary" onClick={resetAndClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function CustomersPage() {
  const queryClient = useQueryClient();

  // ── State ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "dormant" | "vip">("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [financialFilter, setFinancialFilter] = useState<"all" | "debt" | "balanced">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewModal, setShowNewModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<EnhancedCustomer | null>(null);
  const [bookingCustomer, setBookingCustomer] = useState<EnhancedCustomer | null>(null);

  // ── Data fetching ──
  const { data: rawCustomers = [], isLoading } = useQuery<EnhancedCustomer[]>({
    queryKey: ["customers", search, serviceTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ enhanced: "1" });
      if (search) params.set("search", search);
      if (serviceTypeFilter) params.set("serviceType", serviceTypeFilter);
      return fetchJSON<EnhancedCustomer[]>(`/api/customers?${params}`);
    },
  });

  // ── Client-side filtering ──
  const customers = useMemo(() => {
    let filtered = rawCustomers;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Financial filter
    if (financialFilter === "debt") {
      filtered = filtered.filter((c) => c.financial.totalPending > 0);
    } else if (financialFilter === "balanced") {
      filtered = filtered.filter((c) => c.financial.totalPending === 0);
    }

    return filtered;
  }, [rawCustomers, statusFilter, financialFilter]);

  // ── Stats ──
  const stats = useMemo(() => {
    return {
      total: rawCustomers.length,
      active: rawCustomers.filter((c) => c.status === "active").length,
      dormant: rawCustomers.filter((c) => c.status === "dormant").length,
      vip: rawCustomers.filter((c) => c.status === "vip").length,
      withDebt: rawCustomers.filter((c) => c.financial.totalPending > 0).length,
    };
  }, [rawCustomers]);

  // ── Selection helpers ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  }, [customers, selectedIds.size]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── Bulk VIP mutation ──
  const bulkVipMutation = useMutation({
    mutationFn: async ({ ids, addVip }: { ids: string[]; addVip: boolean }) => {
      const selectedCustomers = rawCustomers.filter((c) => ids.includes(c.id));
      const promises = selectedCustomers.map((c) => {
        const tags = parseTags(c.tags);
        let newTags: string[];
        if (addVip) {
          newTags = tags.includes("VIP") ? tags : [...tags, "VIP"];
        } else {
          newTags = tags.filter((t) => t !== "VIP");
        }
        return fetch(`/api/customers/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: JSON.stringify(newTags) }),
        });
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      clearSelection();
    },
  });

  // ── Avatar colors ──
  const getAvatarGradient = (status: string) => {
    switch (status) {
      case "vip":
        return "linear-gradient(135deg, #F59E0B, #D97706)";
      case "active":
        return "linear-gradient(135deg, #F97316, #FB923C)";
      case "dormant":
        return "linear-gradient(135deg, #94A3B8, #64748B)";
      default:
        return "linear-gradient(135deg, #F97316, #FB923C)";
    }
  };

  // ── Determine the "select all" checkbox state ──
  const allSelected = customers.length > 0 && selectedIds.size === customers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div>
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">לקוחות</h1>
          <p className="text-sm text-petra-muted mt-1">
            {stats.total} לקוחות במערכת
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white text-sm shadow-sm transition-all hover:shadow-md"
            style={{ background: "linear-gradient(135deg, #f38d49, #FB923C)" }}
            onClick={() => setShowOrderModal(true)}
          >
            <ShoppingCart className="w-4 h-4" />
            הזמנה חדשה
          </button>
          <button className="btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4" />
            לקוח חדש
          </button>
        </div>
      </div>

      {/* ─── Search & Filters Card ─── */}
      <div className="card p-4 mb-4 space-y-3 bg-gradient-to-b from-[#FDFBF8] to-white border-[#E8DFD5]">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A0845C]" />
          <input
            type="text"
            placeholder="חיפוש לפי שם לקוח, טלפון, אימייל או שם חיה..."
            className="input pr-10 bg-white border-[#E8DFD5] focus:border-[#C4956A] focus:ring-[#C4956A]/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#8B7355] font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>סינון:</span>
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              label="הכל"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              count={stats.total}
            />
            <FilterPill
              label="פעילים"
              active={statusFilter === "active"}
              onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
              count={stats.active}
            />
            <FilterPill
              label="רדומים"
              active={statusFilter === "dormant"}
              onClick={() => setStatusFilter(statusFilter === "dormant" ? "all" : "dormant")}
              count={stats.dormant}
            />
            <FilterPill
              label="VIP"
              active={statusFilter === "vip"}
              onClick={() => setStatusFilter(statusFilter === "vip" ? "all" : "vip")}
              count={stats.vip}
            />
          </div>

          {/* Separator */}
          <div className="hidden sm:block w-px h-5 bg-[#E8DFD5]" />

          {/* Service type dropdown */}
          <div className="relative">
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="appearance-none bg-[#FAF7F3] border border-[#E8DFD5] rounded-full text-xs font-medium text-[#8B7355] pl-7 pr-3 py-1.5 hover:bg-[#F3EDE6] hover:border-[#D4C5B2] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C4956A]/20"
            >
              <option value="">סוג שירות</option>
              {SERVICE_TYPES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0845C] pointer-events-none" />
          </div>

          {/* Financial filter */}
          <div className="flex items-center gap-1.5">
            <FilterPill
              label="חוב"
              active={financialFilter === "debt"}
              onClick={() =>
                setFinancialFilter(financialFilter === "debt" ? "all" : "debt")
              }
              count={stats.withDebt}
            />
            <FilterPill
              label="מאוזן"
              active={financialFilter === "balanced"}
              onClick={() =>
                setFinancialFilter(
                  financialFilter === "balanced" ? "all" : "balanced"
                )
              }
            />
          </div>
        </div>
      </div>

      {/* ─── Bulk Action Bar ─── */}
      {selectedIds.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-3 bg-[#FEF9F4] border-brand-200 animate-slide-up">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-semibold text-petra-text">
              {selectedIds.size} נבחרו
            </span>
          </div>
          <div className="w-px h-5 bg-brand-200" />
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            onClick={() =>
              bulkVipMutation.mutate({
                ids: Array.from(selectedIds),
                addVip: true,
              })
            }
            disabled={bulkVipMutation.isPending}
          >
            <Crown className="w-3.5 h-3.5" />
            סמן כ-VIP
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
            onClick={() =>
              bulkVipMutation.mutate({
                ids: Array.from(selectedIds),
                addVip: false,
              })
            }
            disabled={bulkVipMutation.isPending}
          >
            <X className="w-3.5 h-3.5" />
            הסר VIP
          </button>
          <div className="flex-1" />
          <button
            className="text-xs text-petra-muted hover:text-petra-text transition-colors"
            onClick={clearSelection}
          >
            בטל בחירה
          </button>
        </div>
      )}

      {/* ─── Table ─── */}
      {isLoading ? (
        <div className="card">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b border-slate-50 animate-pulse"
            >
              <div className="w-4 h-4 bg-slate-100 rounded" />
              <div className="w-10 h-10 bg-slate-100 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-slate-100 rounded" />
                <div className="h-3 w-24 bg-slate-100 rounded" />
              </div>
              <div className="h-5 w-14 bg-slate-100 rounded-full" />
              <div className="h-5 w-20 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-petra-text mb-1">
            {rawCustomers.length === 0 ? "אין לקוחות" : "אין תוצאות"}
          </h3>
          <p className="text-sm text-petra-muted mb-4">
            {rawCustomers.length === 0
              ? "התחל על ידי הוספת הלקוח הראשון"
              : "נסה לשנות את הסינון או מילת החיפוש"}
          </p>
          {rawCustomers.length === 0 && (
            <button
              className="btn-primary"
              onClick={() => setShowNewModal(true)}
            >
              <Plus className="w-4 h-4" />
              הוסף לקוח
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-[#FAF7F3] border-b border-[#E8DFD5]">
                  <th className="text-right px-3 py-3 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-petra-text transition-colors"
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-brand-500" />
                      ) : someSelected ? (
                        <MinusSquare className="w-4 h-4 text-brand-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="table-header-cell">שם</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell hidden md:table-cell">
                    חיות
                  </th>
                  <th className="table-header-cell hidden lg:table-cell">
                    פגישות
                  </th>
                  <th className="table-header-cell hidden lg:table-cell">
                    כספי
                  </th>
                  <th className="table-header-cell w-36">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const tags = parseTags(customer.tags);
                  const isSelected = selectedIds.has(customer.id);

                  return (
                    <tr
                      key={customer.id}
                      className={`border-b border-slate-50 hover:bg-[#FDFBF8] transition-colors ${
                        isSelected ? "bg-[#FEF9F4]" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3.5">
                        <button
                          onClick={() => toggleSelect(customer.id)}
                          className="text-slate-400 hover:text-petra-text transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-brand-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Name + phone + tags */}
                      <td className="table-cell">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
                            style={{
                              background: getAvatarGradient(customer.status),
                            }}
                          >
                            {customer.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-petra-text group-hover:text-brand-600 transition-colors">
                              {customer.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-petra-muted flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {customer.phone}
                              </span>
                              {customer.email && (
                                <span
                                  role="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.location.href = `mailto:${customer.email}`;
                                  }}
                                  className="text-[11px] text-petra-muted hover:text-brand-600 hidden sm:flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Mail className="w-3 h-3" />
                                  {customer.email}
                                </span>
                              )}
                            </div>
                            {tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {tags
                                  .filter((t) => t !== "VIP")
                                  .slice(0, 2)
                                  .map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex px-1.5 py-0 rounded text-[10px] bg-[#F3EDE6] text-[#8B7355] font-medium"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <StatusBadge status={customer.status} />
                      </td>

                      {/* Pets */}
                      <td className="table-cell hidden md:table-cell">
                        <PetsCell
                          pets={customer.pets}
                          count={customer._count.pets}
                        />
                      </td>

                      {/* Appointments */}
                      <td className="table-cell hidden lg:table-cell">
                        <AppointmentDates
                          last={customer.lastAppointment}
                          next={customer.nextAppointment}
                        />
                      </td>

                      {/* Financial */}
                      <td className="table-cell hidden lg:table-cell">
                        <FinancialBadge financial={customer.financial} />
                      </td>

                      {/* Quick Actions */}
                      <td className="table-cell">
                        <QuickActions
                          customer={customer}
                          onEdit={() => setEditingCustomer(customer)}
                          onBook={() => setBookingCustomer(customer)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer with summary */}
          <div className="px-5 py-3 bg-[#FAF7F3] border-t border-[#E8DFD5] flex flex-wrap items-center gap-4 text-xs text-[#8B7355]">
            <span>
              מציג {customers.length} מתוך {stats.total} לקוחות
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats.active} פעילים
              </span>
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-600" />
                {stats.vip} VIP
              </span>
              {stats.withDebt > 0 && (
                <span className="flex items-center gap-1 text-red-500 font-medium">
                  {stats.withDebt} עם חוב
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}
      <NewCustomerModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
      />
      <EditCustomerModal
        isOpen={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        customer={editingCustomer}
      />
      <QuickBookModal
        isOpen={!!bookingCustomer}
        onClose={() => setBookingCustomer(null)}
        customer={bookingCustomer}
      />
      <NewOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        customers={rawCustomers}
      />
    </div>
  );
}
