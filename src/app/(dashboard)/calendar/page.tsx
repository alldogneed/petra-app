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
  ExternalLink,
  Copy,
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
import { PetraLoader } from "@/components/ui/PetraLoader";
import { CustomerPicker, type PickerCustomer } from "@/components/customers/CustomerPicker";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { currencySymbol } from "@/lib/format";

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
  staff: { id: string; name: string } | null;
  orderId?: string | null;
}

interface AttachableProgram {
  id: string;
  name: string;
  dogId: string;
  dogName: string;
  totalSessions: number | null;
  completedSessions: number;
  scheduledSessions: number;
  nextSessionNumber: number;
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
  assignedTo: { id: string; name: string } | null;
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

interface TeamMember { id: string; name: string; avatarUrl: string | null }

type ViewMode = "day" | "week" | "month" | "agenda";

// ─── Constants ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
// Day ids in getDay() order (Sunday first); labels: calendarPage.days.*
const DAY_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// Labels: calendarPage.viewModes.*
const VIEW_MODES: { id: ViewMode }[] = [
  { id: "day" },
  { id: "week" },
  { id: "month" },
  { id: "agenda" },
];

// ─── Canonical calendar categories ───────────────────────────────────────────
// Single source of truth for how every calendar event is classified, colored,
// filtered, and mirrored to Google Calendar. Each event resolves to exactly one
// CalCategory. Groups only control visual grouping of the filter chips.
type CalCategory =
  | "appointment"        // generic client appointment / הזמנה
  | "grooming"           // תספורת
  | "boarding"           // פנסיון (שהייה)
  | "consultation"       // ייעוץ
  | "training_home"      // אילוף בבית הלקוח
  | "training_boarding"  // אילוף בתנאי פנסיון
  | "training_group"     // אילוף קבוצתי
  | "workshop"           // סדנאות
  | "task"               // משימות
  | "lead"               // מכירות / לידים
  | "gcal";              // יומן גוגל (חיצוני)

type CalGroupKey = "customer" | "training" | "mgmt";

interface CalCategoryDef {
  key: CalCategory;
  color: string;
  group: CalGroupKey;
  gcalColorId?: string; // Google Calendar colorId (1–11), only for synced kinds
  square?: boolean;     // render swatch as a square (tasks) instead of a dot
}

// Labels: calendarPage.categories.<key>
const CAL_CATEGORIES: CalCategoryDef[] = [
  { key: "appointment",       color: "#0EA5E9", group: "customer", gcalColorId: "7" },
  { key: "grooming",          color: "#EC4899", group: "customer", gcalColorId: "4" },
  { key: "boarding",          color: "#10B981", group: "customer", gcalColorId: "10" },
  { key: "consultation",      color: "#8B5CF6", group: "customer", gcalColorId: "1" },
  { key: "training_home",     color: "#3B82F6", group: "training", gcalColorId: "9" },
  { key: "training_boarding", color: "#1E40AF", group: "training", gcalColorId: "6" },
  { key: "training_group",    color: "#6366F1", group: "training", gcalColorId: "3" },
  { key: "workshop",          color: "#F97316", group: "training", gcalColorId: "11" },
  { key: "task",              color: "#F59E0B", group: "mgmt",     square: true },
  { key: "lead",              color: "#A855F7", group: "mgmt" },
  { key: "gcal",              color: "#4285F4", group: "mgmt" },
];

const CAL_CATEGORY_MAP: Record<CalCategory, CalCategoryDef> = Object.fromEntries(
  CAL_CATEGORIES.map((c) => [c.key, c])
) as Record<CalCategory, CalCategoryDef>;

// Labels: calendarPage.groups.<key>
const CAL_GROUPS: { key: CalGroupKey; keys: CalCategory[] }[] = [
  { key: "customer", keys: ["appointment", "grooming", "boarding", "consultation"] },
  { key: "training", keys: ["training_home", "training_boarding", "training_group", "workshop"] },
  { key: "mgmt", keys: ["task", "lead", "gcal"] },
];

const ALL_CAL_CATEGORIES: CalCategory[] = CAL_CATEGORIES.map((c) => c.key);

/** Resolve an appointment/booking to a canonical category from its service metadata. */
function resolveAppointmentCategory(
  service: { type: string } | null | undefined,
  priceListItem?: { category: string | null } | null
): CalCategory {
  const type = service?.type ?? "";
  const cat = priceListItem?.category ?? "";
  if (type === "grooming" || cat === "טיפוח") return "grooming"; // i18n-ok — DB category value
  if (type === "boarding" || cat === "פנסיון") return "boarding"; // i18n-ok — DB category value
  if (type === "consultation" || cat === "ייעוץ") return "consultation"; // i18n-ok — DB category value
  if (type === "training" || cat === "אילוף") return "training_home"; // i18n-ok — DB category value
  return "appointment";
}

/** Map a TrainingProgram.trainingType to its calendar category. */
function trainingProgramCategory(trainingType: string): CalCategory {
  return trainingType === "BOARDING" ? "training_boarding" : "training_home";
}

/** Map a TrainingGroup.groupType to its calendar category. */
function trainingGroupCategory(groupType: string): CalCategory {
  return groupType === "WORKSHOP" ? "workshop" : "training_group";
}

const TASK_PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#EF4444",
  HIGH: "#F97316",
  MEDIUM: "#F59E0B",
  LOW: "#9CA3AF",
};

// Price-list category values stored in the DB (PriceListItem.category) → label key
const PRICE_LIST_CATEGORIES = [
  { value: "אילוף", key: "training" }, // i18n-ok — DB category value
  { value: "טיפוח", key: "grooming" }, // i18n-ok — DB category value
  { value: "פנסיון", key: "boarding" }, // i18n-ok — DB category value
  { value: "מוצרים", key: "products" }, // i18n-ok — DB category value
] as const;
const PRICE_LIST_CATEGORY_VALUES: string[] = PRICE_LIST_CATEGORIES.map((c) => c.value);
const TRAINING_PRICE_CATEGORY = PRICE_LIST_CATEGORIES[0].value;

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

/**
 * Assign side-by-side lanes to appointments that overlap in time so two
 * clients booked at the same slot render next to each other instead of
 * stacking on top of one another (which hid the second one entirely).
 * Returns a map of appointment id → { lane, lanes }.
 */
function computeOverlapLanes(
  appts: { id: string; startTime: string; endTime: string; status: string }[]
): Map<string, { lane: number; lanes: number }> {
  const result = new Map<string, { lane: number; lanes: number }>();
  const active = appts.filter((a) => a.status !== "canceled");
  const canceled = appts.filter((a) => a.status === "canceled");
  // Canceled appointments are faded and shouldn't steal a lane
  canceled.forEach((a) => result.set(a.id, { lane: 0, lanes: 1 }));

  const sorted = [...active].sort(
    (a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      timeToMinutes(a.endTime) - timeToMinutes(b.endTime)
  );

  let cluster: typeof sorted = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = []; // end-minute per lane
    const laneOf = new Map<string, number>();
    for (const a of cluster) {
      const s = timeToMinutes(a.startTime);
      let placed = laneEnds.findIndex((end) => end <= s);
      if (placed === -1) {
        placed = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[placed] = timeToMinutes(a.endTime);
      laneOf.set(a.id, placed);
    }
    const lanes = laneEnds.length;
    for (const a of cluster) result.set(a.id, { lane: laneOf.get(a.id) ?? 0, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const a of sorted) {
    const s = timeToMinutes(a.startTime);
    if (cluster.length > 0 && s >= clusterEnd) flush();
    cluster.push(a);
    clusterEnd = Math.max(clusterEnd, timeToMinutes(a.endTime));
  }
  flush();
  return result;
}

function getAppointmentColor(
  service: { color: string | null; type: string } | null,
  priceListItem?: { category: string | null } | null
): string {
  if (service?.color) return service.color;
  return CAL_CATEGORY_MAP[resolveAppointmentCategory(service, priceListItem)].color;
}

function getAppointmentLabel(apt: AppointmentEvent, fallback: string): string {
  return apt.service?.name ?? apt.priceListItem?.name ?? apt.notes ?? fallback;
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
  const t = useTranslations("calendar.calendarPage");
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
            ? t("species.dog")
            : appointment.pet.species === "cat"
            ? t("species.cat")
            : t("species.other")}
          )
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-2 text-xs text-petra-muted">
        <Clock className="w-3.5 h-3.5" />
        <span>
          {appointment.startTime} – {appointment.endTime}
        </span>
        <span className="opacity-50">·</span>
        <span>{t("minutesShort", { minutes: getAppointmentDuration(appointment) })}</span>
      </div>
      <div className="text-xs font-medium mt-1.5" style={{ color }}>
        {getAppointmentLabel(appointment, t("appointmentFallback"))}
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
  const t = useTranslations("calendar.calendarPage");
  const tc = useTranslations("common");
  const { locale, currency, cfg } = useBusinessLocale();
  const symbol = currencySymbol({ locale, currency });
  const queryClient = useQueryClient();
  const { can: canPlan } = usePlan();
  const { canSendMessages } = usePermissions();
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

  const [pickedCustomer, setPickedCustomer] = useState<PickerCustomer | null>(null);
  // null = automatic: ticked only for a training item, so a grooming slot never eats a package meeting
  const [attachChoice, setAttachToProgram] = useState<boolean | null>(null);
  const [attachProgramId, setAttachProgramId] = useState("");

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
      setAttachToProgram(null);
      setAttachProgramId("");
    }
  }, [isOpen, defaultDate, defaultTime]);

  // Training packages (individual programs with meetings left) this appointment can join
  const { data: attachablePrograms = [] } = useQuery<AttachableProgram[]>({
    queryKey: ["attachable-programs", form.customerId, form.petId || null],
    queryFn: async () => {
      const params = new URLSearchParams({ customerId: form.customerId });
      if (form.petId) params.set("petId", form.petId);
      const r = await fetch(`/api/training-programs/attachable?${params.toString()}`);
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: isOpen && !!form.customerId,
    staleTime: 30_000,
  });
  const attachProgram =
    attachablePrograms.find((p) => p.id === attachProgramId) ?? attachablePrograms[0] ?? null;

  const { data: priceListItems = [] } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items-all-active"],
    queryFn: () => fetch("/api/price-list-items").then((r) => r.json()),
    enabled: isOpen,
  });

  const selectedCustomer = pickedCustomer && pickedCustomer.id === form.customerId ? pickedCustomer : null;
  const selectedItem = priceListItems.find((i) => i.id === form.priceListItemId);
  const attachToProgram = attachChoice ?? selectedItem?.category === TRAINING_PRICE_CATEGORY;
  const willAttach = !recurring && attachToProgram && !!attachProgram;
  const endTime = selectedItem?.durationMinutes
    ? addMinutes(form.startTime, selectedItem.durationMinutes)
    : addMinutes(form.startTime, 60);

  const mutation = useMutation({
    mutationFn: (data: typeof form & { endTime: string; trainingProgramId?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["gcal-external-events"] });
      const linkedSession = result?.trainingSession as { id: string; sessionNumber: number } | undefined;
      if (linkedSession || (!recurring && willAttach)) {
        queryClient.invalidateQueries({ queryKey: ["training-program-sessions-cal"] });
        queryClient.invalidateQueries({ queryKey: ["training-programs"] });
        queryClient.invalidateQueries({ queryKey: ["training"] });
        queryClient.invalidateQueries({ queryKey: ["attachable-programs"] });
      }

      if (recurring && result?.created) {
        toast.success(t("newModal.toasts.recurringCreated", { count: result.created }));
      } else {
        const newId = result?.id as string | undefined;
        toast.success(linkedSession ? t("newModal.toasts.createdLinked", { session: linkedSession.sessionNumber }) : t("newModal.toasts.created"), newId && selectedCustomer?.phone && canPlan("whatsapp_reminders") && canSendMessages ? {
          action: {
            label: t("newModal.toasts.sendReminder"),
            onClick: () => fetch(`/api/appointments/${newId}/remind`, { method: "POST" })
              .then((r) => r.json())
              .then((d) => { if (d.success) toast.success(t("newModal.toasts.reminderSent")); else toast.error(d.error ?? t("newModal.toasts.error")); })
              .catch(() => toast.error(t("newModal.toasts.sendError"))),
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
      setPickedCustomer(null);
    },
    onError: (err: Error) => {
      if (err.message?.includes("מוגבל") || err.message?.includes("50")) { // i18n-ok — matches the API error text
        toast.error(t("newModal.toasts.limitReached"));
      } else {
        toast.error(t("newModal.toasts.createError"));
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
            <h2 className="text-xl font-bold text-petra-text">{t("newModal.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">{t("newModal.subtitle")}</p>
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
            <label className="label">{t("newModal.customerLabel")}</label>
            <CustomerPicker
              value={form.customerId || null}
              selectedCustomer={selectedCustomer}
              onSelect={(c, matchedPetId) => {
                setPickedCustomer(c);
                setAttachProgramId("");
                setAttachToProgram(null);
                setForm((f) => ({
                  ...f,
                  customerId: c.id,
                  petId: matchedPetId ?? "",
                }));
              }}
              onClear={() => {
                setPickedCustomer(null);
                setAttachProgramId("");
                setForm((f) => ({ ...f, customerId: "", petId: "" }));
              }}
            />
          </div>
          <div>
            <label className="label">{t("newModal.serviceLabel")}</label>
            <select
              className="input"
              value={form.priceListItemId}
              onChange={(e) =>
                setForm({ ...form, priceListItemId: e.target.value })
              }
            >
              <option value="">{t("newModal.noService")}</option>
              {PRICE_LIST_CATEGORIES.map(({ value: cat, key: catKey }) => {
                const catItems = priceListItems.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <optgroup key={cat} label={t(`priceCategories.${catKey}`)}>
                    {catItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}{i.durationMinutes ? t("newModal.durationSuffix", { minutes: i.durationMinutes }) : ""}{t("newModal.priceSuffix", { symbol, price: String(i.basePrice) })}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              {priceListItems.filter((i) => !i.category || !PRICE_LIST_CATEGORY_VALUES.includes(i.category)).length > 0 && (
                <optgroup label={t("newModal.generalGroup")}>
                  {priceListItems.filter((i) => !i.category || !PRICE_LIST_CATEGORY_VALUES.includes(i.category)).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}{i.durationMinutes ? t("newModal.durationSuffix", { minutes: i.durationMinutes }) : ""}{t("newModal.priceSuffix", { symbol, price: String(i.basePrice) })}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {priceListItems.length === 0 && (
              <p className="text-xs text-petra-muted mt-1">
                {t("newModal.emptyPriceList")}
              </p>
            )}
          </div>
          {selectedCustomer && selectedCustomer.pets?.length > 0 && (
            <div>
              <label className="label">{t("newModal.petLabel")}</label>
              <select
                className="input"
                value={form.petId}
                onChange={(e) => {
                  setForm({ ...form, petId: e.target.value });
                  setAttachProgramId("");
                }}
              >
                <option value="">{t("newModal.noPet")}</option>
                {selectedCustomer.pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Attach to a training package */}
          {attachProgram && !recurring && (
            <div className="border border-orange-200 bg-orange-50/60 rounded-xl p-3 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 rounded accent-orange-500"
                  checked={attachToProgram}
                  onChange={(e) => setAttachToProgram(e.target.checked)}
                />
                <span className="text-sm text-petra-text">
                  {t.rich("newModal.attachLabel", {
                    name: attachProgram.name,
                    session: attachProgram.nextSessionNumber,
                    strong: (c) => <strong>{c}</strong>,
                  })}
                  {attachProgram.totalSessions ? `/${attachProgram.totalSessions}` : ""}
                  {!form.petId && attachProgram.dogName ? ` (${attachProgram.dogName})` : ""}
                </span>
              </label>
              {attachToProgram && attachablePrograms.length > 1 && (
                <select
                  className="input text-sm"
                  value={attachProgram.id}
                  onChange={(e) => setAttachProgramId(e.target.value)}
                >
                  {attachablePrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t("newModal.attachOption", { name: p.name, dog: p.dogName, session: p.nextSessionNumber })}
                      {p.totalSessions ? `/${p.totalSessions}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("newModal.dateLabel")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("newModal.timeLabel")}</label>
              <input
                type="time"
                className="input"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
              />
              {selectedItem && (
                <p className="text-xs text-petra-muted mt-1">{t("newModal.endTime", { time: endTime })}</p>
              )}
            </div>
          </div>
          {/* Conflict warning */}
          {conflictingApts.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">{t("newModal.conflict")}</span>
                {conflictingApts.map((a) => (
                  <span key={a.id}>
                    {a.customer.name} ({a.startTime}–{a.endTime} · {getAppointmentLabel(a, t("appointmentFallback"))})
                  </span>
                )).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
              </div>
            </div>
          )}

          <div>
            <label className="label">{t("newModal.notesLabel")}</label>
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
              <span className="text-sm font-medium text-petra-text">{t("newModal.recurring")}</span>
            </label>
            {recurring && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label text-xs">{t("newModal.frequency")}</label>
                  <select
                    className="input text-sm"
                    value={repeatEvery}
                    onChange={(e) => setRepeatEvery(e.target.value as "week" | "2weeks" | "month")}
                  >
                    <option value="week">{t("newModal.everyWeek")}</option>
                    <option value="2weeks">{t("newModal.everyTwoWeeks")}</option>
                    <option value="month">{t("newModal.everyMonth")}</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">{t("newModal.occurrences")}</label>
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
                  {t.rich("newModal.recurringSummary", {
                    count: occurrences,
                    date: form.date || t("newModal.selectedDate"),
                    strong: (c) => <strong>{c}</strong>,
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.customerId || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                ...form,
                // Server requires a service, price-list item, OR notes to describe
                // the appointment. For a service-less general appointment, fall
                // back to a default note so booking still succeeds.
                notes: form.notes || (form.priceListItemId ? "" : (willAttach ? t("newModal.defaultNoteTraining") : t("newModal.defaultNoteGeneral"))),
                endTime,
                // Attaching to a package: link the dog of that package when none was chosen
                ...(willAttach && attachProgram
                  ? { trainingProgramId: attachProgram.id, petId: form.petId || attachProgram.dogId }
                  : {}),
              })
            }
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending ? tc("progress.saving") : recurring ? t("newModal.createMany", { count: occurrences }) : t("newModal.createOne")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
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
  const t = useTranslations("calendar.calendarPage");
  const tc = useTranslations("common");
  const { locale, currency } = useBusinessLocale();
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
      toast.success(t("payment.toasts.saved"));
    },
    onError: () => toast.error(t("payment.toasts.error")),
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-petra-text">{t("payment.title")}</h2>
            <p className="text-xs text-petra-muted mt-0.5">
              {appointment.customer.name} · {getAppointmentLabel(appointment, t("appointmentFallback"))}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("payment.amountLabel", { symbol: currencySymbol({ locale, currency }) })}</label>
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
            <label className="label">{t("payment.methodLabel")}</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">{t("payment.methods.cash")}</option>
              <option value="credit_card">{t("payment.methods.credit_card")}</option>
              <option value="bit">{t("payment.methods.bit")}</option>
              <option value="paybox">{t("payment.methods.paybox")}</option>
              <option value="bank_transfer">{t("payment.methods.bank_transfer")}</option>
              <option value="check">{t("payment.methods.check")}</option>
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
            {mutation.isPending ? tc("progress.saving") : t("payment.save")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Calendar Page ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const t = useTranslations("calendar.calendarPage");
  return (
    <TierGate
      feature="appointments"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
    >
      <CalendarContent />
    </TierGate>
  );
}

function CalendarContent() {
  const t = useTranslations("calendar.calendarPage");
  const tc = useTranslations("common");
  const { locale, cfg } = useBusinessLocale();
  const aptLabel = (apt: AppointmentEvent) => getAppointmentLabel(apt, t("appointmentFallback"));
  const taskCategoryLabel = (category: string) =>
    t.has(`taskCategories.${category}`) ? t(`taskCategories.${category}`) : category;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canSendMessages } = usePermissions();
  const { isFree, tier, can } = usePlan();
  const maxAppts = getMaxAppointments(tier);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  // Agenda view: distinguish a real tap from a scroll/drag so swiping to scroll
  // doesn't fire the day-header (→ day view) or item link (→ customer) by accident.
  const agendaPointerDown = useRef<{ x: number; y: number } | null>(null);

  // ── State ──
  const [anchor, setAnchor] = useState(new Date());
  // Initial value must match SSR output (no window on server) — switch to
  // mobile day-view only after hydration to avoid a hydration mismatch.
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  // On phones: portrait → day view, landscape → week view (rotate to see the week).
  // Desktop is left untouched. A phone is detected by its smaller dimension < 768.
  // IMPORTANT: only react when the orientation actually flips. On mobile the
  // browser fires `resize` every time the address bar shows/hides during scroll
  // (innerHeight changes by ~56px) — reacting to that flipped the view back and
  // forth as the user scrolled, and also clobbered any manual view choice.
  const lastLandscapeRef = useRef<boolean | null>(null);
  useEffect(() => {
    const applyResponsiveView = () => {
      const isPhone = Math.min(window.innerWidth, window.innerHeight) < 768;
      if (!isPhone) return;
      const landscape = window.innerWidth > window.innerHeight;
      if (lastLandscapeRef.current === landscape) return; // orientation unchanged → ignore (scroll/url-bar)
      lastLandscapeRef.current = landscape;
      setViewMode(landscape ? "week" : "day");
    };
    applyResponsiveView();
    window.addEventListener("orientationchange", applyResponsiveView);
    window.addEventListener("resize", applyResponsiveView);
    return () => {
      window.removeEventListener("orientationchange", applyResponsiveView);
      window.removeEventListener("resize", applyResponsiveView);
    };
  }, []);
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
  // Canonical filter state: the set of categories currently shown. Default = all.
  const [activeCategories, setActiveCategories] = useState<Set<CalCategory>>(
    () => new Set(ALL_CAL_CATEGORIES)
  );
  const toggleCategory = (key: CalCategory) =>
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [hoveredApt, setHoveredApt] = useState<{
    apt: AppointmentEvent;
    x: number;
    y: number;
  } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  // Appointment id from a ?apt= deep-link, consumed once appointments load
  const [pendingAptId, setPendingAptId] = useState<string | null>(null);

  // ── Deep-link from dashboard / customer card: ?date=YYYY-MM-DD&apt=<id> ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam) {
      const d = new Date(`${dateParam.slice(0, 10)}T12:00:00`);
      if (!isNaN(d.getTime())) {
        setAnchor(d);
        setSelectedDay(d);
        setViewMode("day");
      }
    }
    const aptParam = params.get("apt");
    if (aptParam) setPendingAptId(aptParam);
  }, []);

  // ── Current time tick ──
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const [allDayCollapsed, setAllDayCollapsed] = useState(true);
  // Legacy overlay booleans, now derived from the canonical category set so the
  // many `showX &&` render gates keep working unchanged.
  const showGcal = activeCategories.has("gcal");
  const showLeads = activeCategories.has("lead");
  const showTasks = activeCategories.has("task");
  const showGroupSessions = activeCategories.has("training_group") || activeCategories.has("workshop");
  const showProgramSessions = activeCategories.has("training_home") || activeCategories.has("training_boarding");
  const [dragging, setDragging] = useState<{ apt: AppointmentEvent; durationMins: number; offsetMins: number } | null>(null);
  const [dropPreview, setDropPreview] = useState<{ date: string; startMins: number } | null>(null);
  const [staffFilter, setStaffFilter] = useState<string[]>([]);
  const [resizing, setResizing] = useState<{ apt: AppointmentEvent; startY: number; origEndMins: number; currentEndMins: number } | null>(null);
  const resizingRef = useRef<typeof resizing>(null);

  // ── Persist filter toggles to localStorage ──
  // Restored inside useEffect (not at useState init) to avoid SSR/hydration
  // mismatches — same pattern as the viewMode/innerWidth fix.
  const [filtersRestored, setFiltersRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("petra-calendar-categories");
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.categories)) {
          const valid = saved.categories.filter(
            (c: unknown): c is CalCategory => typeof c === "string" && (ALL_CAL_CATEGORIES as string[]).includes(c)
          );
          setActiveCategories(new Set(valid));
        }
        if (Array.isArray(saved.staffFilter)) setStaffFilter(saved.staffFilter.filter((t: unknown) => typeof t === "string"));
      }
    } catch {
      // ignore corrupt localStorage
    }
    setFiltersRestored(true);
  }, []);
  useEffect(() => {
    if (!filtersRestored) return;
    try {
      localStorage.setItem(
        "petra-calendar-categories",
        JSON.stringify({ categories: Array.from(activeCategories), staffFilter })
      );
    } catch {
      // ignore quota/private-mode errors
    }
  }, [filtersRestored, activeCategories, staffFilter]);

  // Dashboard "קביעת תור" links here with ?new=1 → open the new-appointment modal right away
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    setModalDefaults({ date: toLocalDateString(new Date()), time: "09:00" });
    setShowNewModal(true);
    params.delete("new");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

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
  const { data: appointments = [], isError: appointmentsError, isLoading: appointmentsLoading } = useQuery<AppointmentEvent[]>({
    queryKey: ["appointments", from, to],
    queryFn: () =>
      fetchJSON(`/api/appointments?from=${from}&to=${to}`),
  });

  // Open the appointment edit modal when arriving via a ?apt= deep-link
  useEffect(() => {
    if (!pendingAptId) return;
    const found = appointments.find((a) => a.id === pendingAptId);
    if (found) {
      setSelectedAppointment(found);
      setPendingAptId(null);
    }
  }, [pendingAptId, appointments]);

  // Total appointment count — only fetched for free tier to show limit banner
  const { data: totalApptCount = 0 } = useQuery<number>({
    queryKey: ["appointments-total-count"],
    queryFn: () => fetchJSON<AppointmentEvent[]>("/api/appointments").then((r) => r.length),
    enabled: isFree && maxAppts !== null,
    staleTime: 60_000,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: () => fetchJSON("/api/team-members"),
  });

  // Staff filter only applies when the business actually has more than one team member,
  // and never hides unassigned items (a stale saved filter used to blank the whole calendar).
  const effectiveStaffFilter = useMemo(
    () => (teamMembers.length > 1 ? staffFilter.filter((id) => teamMembers.some((m) => m.id === id)) : []),
    [staffFilter, teamMembers]
  );

  const filteredAppointments = useMemo(
    () => appointments.filter((a) => {
      if (!activeCategories.has(resolveAppointmentCategory(a.service, a.priceListItem))) return false;
      if (effectiveStaffFilter.length > 0 && a.staff?.id && !effectiveStaffFilter.includes(a.staff.id)) return false;
      return true;
    }),
    [appointments, activeCategories, effectiveStaffFilter]
  );


  // Staff list sourced from team-members API
  const staffList = teamMembers;

  // Overdue helper
  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();

  const { data: boardingStays = [] } = useQuery<BoardingStayEvent[]>({
    queryKey: ["boarding-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/boarding?from=${from}&to=${to}`),
    enabled: viewMode !== "month",
  });

  const { data: tasksRaw = [] } = useQuery<TaskEvent[]>({
    queryKey: ["tasks-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/tasks?from=${from}&to=${to}&status=OPEN`),
  });
  // Gate all task rendering through the "משימות" category toggle.
  const tasks = useMemo(() => (showTasks ? tasksRaw : []), [showTasks, tasksRaw]);

  interface LeadFollowUp {
    id: string;
    name: string;
    phone?: string;
    nextFollowUpAt: string;
    requestedService?: string;
  }
  interface LeadMeetingEvent {
    id: string;
    leadId: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string | null;
    service: { id: string; name: string } | null;
    lead: { id: string; name: string; phone: string | null };
  }
  const { data: leadFollowUpsData } = useQuery<{ leads: LeadFollowUp[]; meetings?: LeadMeetingEvent[] }>({
    queryKey: ["leads-calendar", from, to],
    queryFn: () => fetchJSON(`/api/leads/calendar?from=${from}&to=${to}`),
  });
  const leadFollowUps = leadFollowUpsData?.leads ?? [];
  const leadMeetings = leadFollowUpsData?.meetings ?? [];
  // Lead meetings render as solid violet blocks (follow-ups are pale violet)
  const LEAD_MEETING_COLOR = "#7C3AED";
  const leadMeetingLabel = (m: LeadMeetingEvent) => t("leadMeetingLabel", { name: m.lead.name });
  const leadMeetingTitle = (m: LeadMeetingEvent) =>
    `${leadMeetingLabel(m)}${m.service ? ` · ${m.service.name}` : ""} (${m.startTime}–${m.endTime})${m.location ? ` · ${m.location}` : ""}`;

  // Pending online bookings (not yet converted to appointments)
  const { data: pendingBookingsRaw = [] } = useQuery<BookingCalEvent[]>({
    queryKey: ["bookings-calendar", from, to],
    queryFn: () =>
      fetchJSON(`/api/booking/bookings?status=pending&from=${from}&to=${to}`),
    enabled: viewMode !== "month",
  });

  // Pending online bookings are customer-initiated → classify like appointments.
  const pendingBookings = useMemo(
    () => pendingBookingsRaw.filter((b) =>
      activeCategories.has(resolveAppointmentCategory(b.service, null))
    ),
    [pendingBookingsRaw, activeCategories]
  );

  // Boarding stays are always the "boarding" (פנסיון) category.
  const filteredBoardingStays = useMemo(
    () => boardingStays.filter((s) => {
      if (!activeCategories.has("boarding")) return false;
      if (effectiveStaffFilter.length > 0 && s.assignedTo?.id && !effectiveStaffFilter.includes(s.assignedTo.id)) return false;
      return true;
    }),
    [boardingStays, activeCategories, effectiveStaffFilter]
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

  // ── Training group sessions overlay ──
  interface TrainingGroupCalEvent {
    id: string;
    sessionDatetime: string;
    sessionNumber: number | null;
    status: string;
    trainingGroup: {
      id: string;
      name: string;
      groupType: string;
      location: string | null;
    };
    attendance: { id: string }[];
  }
  const { data: trainingGroupSessionsRaw = [] } = useQuery<TrainingGroupCalEvent[]>({
    queryKey: ["training-group-sessions-cal", from, to],
    queryFn: () => fetchJSON(`/api/training-groups/calendar?from=${from}&to=${to}`),
    staleTime: 2 * 60_000,
  });
  // Split by category: workshops (סדנאות) vs. group training (אילוף קבוצתי)
  const trainingGroupSessions = useMemo(
    () => trainingGroupSessionsRaw.filter((s) =>
      activeCategories.has(trainingGroupCategory(s.trainingGroup.groupType))
    ),
    [trainingGroupSessionsRaw, activeCategories]
  );

  // ── Individual training-program sessions overlay ──
  interface TrainingProgramCalEvent {
    id: string;
    sessionDate: string;
    sessionNumber: number | null;
    durationMinutes: number;
    status: string;
    program: {
      id: string;
      name: string;
      trainingType: string;
      location: string | null;
      dog: { id: string; name: string } | null;
      customer: { id: string; name: string } | null;
    };
  }
  const { data: trainingProgramSessionsRaw = [] } = useQuery<TrainingProgramCalEvent[]>({
    queryKey: ["training-program-sessions-cal", from, to],
    queryFn: () => fetchJSON(`/api/training-programs/calendar?from=${from}&to=${to}`),
    staleTime: 2 * 60_000,
  });
  // Split by category: home training (בבית) vs. boarding-condition training (בפנסיון)
  const trainingProgramSessions = useMemo(
    () => trainingProgramSessionsRaw.filter((s) =>
      activeCategories.has(trainingProgramCategory(s.program.trainingType))
    ),
    [trainingProgramSessionsRaw, activeCategories]
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status, cancellationNote }: { id: string; status: string; cancellationNote?: string }) =>
      fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(cancellationNote ? { cancellationNote } : {}) }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      if (status === "canceled") queryClient.invalidateQueries({ queryKey: ["gcal-external-events"] });
      setSelectedAppointment(null);
      if (status === "completed") toast.success(t("toasts.completed"));
      else if (status === "canceled") toast.success(t("toasts.canceled"));
    },
    onError: () => toast.error(t("toasts.updateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/appointments/${id}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_APPOINTMENT_${id}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSelectedAppointment(null);
      setConfirmDeleteId(null);
      toast.success(t("toasts.deleted"));
    },
    onError: () => toast.error(t("toasts.deleteError")),
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
      queryClient.invalidateQueries({ queryKey: ["gcal-external-events"] });
      setSelectedAppointment(null);
      setRescheduling(false);
      toast.success(t("toasts.moved"));
    },
    onError: () => toast.error(t("toasts.updateError")),
  });

  // Duplicate an appointment to the same date/time (same customer, pet & service)
  const duplicateMutation = useMutation({
    mutationFn: (apt: AppointmentEvent) =>
      fetchJSON(`/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: apt.customer.id,
          petId: apt.pet?.id ?? null,
          serviceId: apt.service?.id ?? null,
          priceListItemId: apt.priceListItem?.id ?? null,
          date: toLocalDateString(new Date(apt.date)),
          startTime: apt.startTime,
          endTime: apt.endTime,
          notes: apt.notes ?? null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedAppointment(null);
      toast.success(t("toasts.duplicated"));
    },
    onError: () => toast.error(t("toasts.duplicateError")),
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
      toast.success(t("toasts.notesUpdated"));
    },
    onError: () => toast.error(t("toasts.notesError")),
  });

  const remindMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/appointments/${id}/remind`, { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? t("toasts.error"));
        return data;
      }),
    onSuccess: () => toast.success(t("toasts.reminderSent")),
    onError: (err: Error) => toast.error(err.message || t("toasts.reminderError")),
  });

  const taskCompleteMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "COMPLETED" | "OPEN" }) =>
      fetchJSON(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks-calendar"] }),
    onError: () => toast.error(t("toasts.taskUpdateError")),
  });

  // ── Navigation ──
  const navigate = (direction: -1 | 1) => {
    if (viewMode === "day") {
      const d = new Date(selectedDay);
      d.setDate(d.getDate() + direction);
      setSelectedDay(d);
      setAnchor(d);
    } else if (viewMode === "week" || viewMode === "agenda") {
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
      return selectedDay.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "month") {
      return anchor.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
    }
    return `${weekDates[0].toLocaleDateString(locale, { day: "numeric", month: "long" })} – ${weekDates[6].toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}`;
  }, [viewMode, selectedDay, anchor, weekDates, locale]);

  // ── Current time indicator ──
  const currentTimeTop = useMemo(() => {
    if (!now) return null;
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
    if (!now) return -1;
    const todayStr = toLocalDateString(now);
    return weekDates.findIndex((d) => toLocalDateString(d) === todayStr);
  }, [now, viewMode, weekDates]);

  // ── Drag helpers ──
  const minutesToTime = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const handleDragStart = (apt: AppointmentEvent, e: React.DragEvent) => {
    const dur = timeToMinutes(apt.endTime) - timeToMinutes(apt.startTime);
    const blockRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetMins = Math.floor(((e.clientY - blockRect.top) / SLOT_HEIGHT) * 60);
    setDragging({ apt, durationMins: dur, offsetMins });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleGridDragOver = (date: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging || !timeGridRef.current) return;
    const gridRect = timeGridRef.current.getBoundingClientRect();
    const rawMins = DAY_START + ((e.clientY - gridRect.top) / SLOT_HEIGHT) * 60 - dragging.offsetMins;
    const snapped = Math.round(rawMins / 15) * 15;
    setDropPreview({ date, startMins: Math.max(DAY_START, Math.min(snapped, DAY_START + 12 * 60)) });
  };

  const handleGridDrop = (date: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging || !dropPreview) return;
    const endMins = dropPreview.startMins + dragging.durationMins;
    rescheduleMutation.mutate({
      id: dragging.apt.id,
      date,
      startTime: minutesToTime(dropPreview.startMins),
      endTime: minutesToTime(endMins),
    });
    setDragging(null);
    setDropPreview(null);
  };

  // ── Resize handlers ──
  const handleResizeStart = (apt: AppointmentEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const origEndMins = timeToMinutes(apt.endTime);
    const state = { apt, startY: e.clientY, origEndMins, currentEndMins: origEndMins };
    setResizing(state);
    resizingRef.current = state;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r || !timeGridRef.current) return;
      const deltaY = e.clientY - r.startY;
      const deltaMins = Math.round((deltaY / SLOT_HEIGHT) * 60 / 15) * 15;
      const newEndMins = Math.max(
        timeToMinutes(r.apt.startTime) + 15,
        Math.min(r.origEndMins + deltaMins, DAY_START + 13 * 60)
      );
      const updated = { ...r, currentEndMins: newEndMins };
      resizingRef.current = updated;
      setResizing(updated);
    };
    const onUp = () => {
      const r = resizingRef.current;
      if (!r) return;
      rescheduleMutation.mutate({
        id: r.apt.id,
        date: r.apt.date.slice(0, 10),
        startTime: r.apt.startTime,
        endTime: minutesToTime(r.currentEndMins),
      });
      resizingRef.current = null;
      setResizing(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hover handlers ──
  const handleHoverEnter = (apt: AppointmentEvent, e: React.MouseEvent) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Capture the element now — React nulls e.currentTarget once the handler
    // returns, so reading it inside the timeout throws on null.
    const target = e.currentTarget as HTMLElement;
    hoverTimerRef.current = setTimeout(() => {
      if (!target || !target.isConnected) return;
      const rect = target.getBoundingClientRect();
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
    if (viewMode === "month" || filteredBoardingStays.length === 0) return [];
    return filteredBoardingStays;
  }, [filteredBoardingStays, viewMode]);

  // ── Day view helpers ──
  const dayAppointments = useMemo(() => {
    if (viewMode !== "day") return [];
    const dayStr = toLocalDateString(selectedDay);
    return filteredAppointments.filter((a) => a.date.slice(0, 10) === dayStr);
  }, [filteredAppointments, selectedDay, viewMode]);

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
    const isResizingThis = resizing?.apt.id === apt.id;
    const effectiveHeight = isResizingThis
      ? Math.max(((resizing.currentEndMins - timeToMinutes(apt.startTime)) / 60) * SLOT_HEIGHT, 20)
      : undefined;
    return (
      <div
        key={apt.id}
        draggable={!resizing}
        onDragStart={(e) => handleDragStart(apt, e)}
        onDragEnd={() => { setDragging(null); setDropPreview(null); }}
        className={cn(
          "absolute rounded-lg px-2 py-1 overflow-hidden cursor-grab active:cursor-grabbing transition-all text-white",
          compact ? "text-xs" : "text-sm",
          isCanceled ? "opacity-40" : "hover:brightness-95",
          dragging?.apt.id === apt.id && "opacity-50"
        )}
        style={{
          ...style,
          height: effectiveHeight ?? style.height,
          background: color,
          boxShadow: isCanceled ? "none" : `0 1px 3px ${color}40`,
          zIndex: isResizingThis ? 20 : 10,
          minHeight: compact ? undefined : 60,
          pointerEvents: dragging && dragging.apt.id !== apt.id ? "none" : undefined,
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
          <div className="absolute top-1 end-1 w-2 h-2 rounded-full bg-green-300 border border-green-400" />
        )}
        {apt.status === "no_show" && (
          <div className="absolute top-1 end-1 w-2 h-2 rounded-full bg-gray-300 border border-gray-400" />
        )}

        <div className={cn("font-medium", compact ? "truncate" : "line-clamp-2 break-words", isCanceled && "line-through")}>
          {apt.pet ? apt.pet.name : apt.customer.name}
        </div>
        {apt.pet && (
          <div className={cn("opacity-80", compact ? "truncate" : "line-clamp-1")}>{apt.customer.name}</div>
        )}
        <div className={cn("opacity-80", compact ? "truncate" : "line-clamp-1")}>{aptLabel(apt)}</div>
        <div className="opacity-80">{apt.startTime}</div>
        {apt.staff && !compact && (
          <div className="text-[10px] opacity-70 truncate">👤 {apt.staff.name}</div>
        )}
        {/* Resize handle */}
        {!isCanceled && (
          <div
            className="absolute bottom-0 end-0 start-0 h-2 cursor-s-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleResizeStart(apt, e)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-6 h-0.5 bg-white/60 rounded-full" />
          </div>
        )}
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
        title={t("pendingBookingTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 font-medium text-amber-800 truncate">
          <AlertCircle className="w-3 h-3 flex-shrink-0 text-amber-500" />
          {booking.customer.name}
        </div>
        <div className="text-amber-600 truncate">{booking.service?.name ?? t("unknownService")}</div>
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
    const isDone = task.status === "COMPLETED";
    const overdue = !isDone && task.dueAt && isOverdue(task.dueAt);
    return (
      <div
        key={`task-${task.id}`}
        className={cn(
          "absolute rounded-lg px-2 py-1 overflow-hidden bg-white border",
          compact ? "text-xs" : "text-sm",
          overdue ? "border-red-300 bg-red-50" : "border-slate-200",
          isDone && "opacity-50"
        )}
        style={{
          ...style,
          borderInlineStart: `3px solid ${overdue ? "#EF4444" : color}`,
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-1 font-medium text-petra-text truncate">
          <button
            className="flex-shrink-0 w-3.5 h-3.5 rounded border border-slate-300 flex items-center justify-center hover:border-green-400 transition-colors"
            style={{ background: isDone ? "#22C55E" : "white" }}
            onClick={(e) => {
              e.stopPropagation();
              taskCompleteMutation.mutate({ id: task.id, status: isDone ? "OPEN" : "COMPLETED" });
            }}
          >
            {isDone && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: overdue ? "#EF4444" : color }} />
          <span className={cn("truncate", isDone && "line-through text-petra-muted")}>{task.title}</span>
        </div>
        {!compact && (
          <div className={cn("truncate", overdue ? "text-red-500 text-[10px] font-medium" : "text-petra-muted")}>
            {overdue ? t("overdue") : taskCategoryLabel(task.category)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageTitle title={t("title")} />
      {appointmentsLoading && <PetraLoader />}
      {appointmentsError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {t("loadError")}
        </div>
      )}
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 mb-4 md:mb-6">
        {/* Top row: title + new appointment */}
        <div className="flex items-center gap-2">
          <div>
            <h1 className="page-title">{t("title")}</h1>
            <p className="text-xs text-petra-muted mt-0.5">{headerSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Week Summary WhatsApp button — only in week view */}
            {viewMode === "week" && (() => {
              const weekAppts = filteredAppointments
                .filter((a) => a.status !== "canceled")
                .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime.localeCompare(b.startTime));
              if (weekAppts.length === 0) return null;
              const weekLabel = `${weekDates[0].toLocaleDateString(locale, { day: "numeric", month: "long" })} – ${weekDates[6].toLocaleDateString(locale, { day: "numeric", month: "long" })}`;
              const lines = [t("summary.weekHeader", { range: weekLabel }), t("summary.total", { count: weekAppts.length }), ""];
              const byDay: Record<string, typeof weekAppts> = {};
              for (const a of weekAppts) {
                const key = a.date.slice(0, 10);
                if (!byDay[key]) byDay[key] = [];
                byDay[key].push(a);
              }
              for (const dateStr of Object.keys(byDay).sort()) {
                const date = new Date(dateStr + "T00:00:00");
                const dayLabel = `${t(`days.${DAY_IDS[date.getDay()]}`)} ${date.toLocaleDateString(locale, { day: "numeric", month: "long" })}`;
                lines.push(`📌 ${dayLabel}:`);
                byDay[dateStr].forEach((a, i) => {
                  lines.push(`  ${i + 1}. ${a.startTime} — ${a.customer.name}${a.pet ? ` (${a.pet.name})` : ""} · ${aptLabel(a)}`);
                });
                lines.push("");
              }
              const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n"))}`;
              return (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm hidden sm:flex items-center gap-1.5"
                  title={t("summary.shareWeekTitle")}
                >
                  <Share2 className="w-4 h-4" />
                  {t("summary.week")}
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
              const dateLabel = summaryDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
              const lines = [
                t("summary.dayHeader", { date: dateLabel }),
                t("summary.total", { count: summaryAppts.length }),
                "",
                ...summaryAppts.map((a, i) =>
                  `${i + 1}. ${a.startTime} — ${a.customer.name}${a.pet ? ` (${a.pet.name})` : ""} · ${aptLabel(a)}`
                ),
              ];
              const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join("\n"))}`;
              return (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm hidden sm:flex items-center gap-1.5"
                  title={t("summary.shareDayTitle")}
                >
                  <Share2 className="w-4 h-4" />
                  {t("summary.day")}
                </a>
              );
            })()}
            {isFree && maxAppts !== null && totalApptCount >= maxAppts ? (
              <a href="/upgrade" className="btn-primary text-sm gap-1.5 bg-amber-500 hover:bg-amber-600 border-amber-500 text-white rounded-xl px-3 py-2 font-semibold flex items-center">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">{t("upgradeToBasic")}</span>
                <span className="sm:hidden">{t("upgrade")}</span>
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
                <span className="hidden sm:inline">{t("newAppointment")}</span>
                <span className="sm:hidden">{t("newShort")}</span>
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
                {t("freeLimit", { count: totalApptCount, max: maxAppts })}
              </span>
            </div>
            {totalApptCount >= maxAppts && (
              <a href="/upgrade" className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
                {t("upgradeToBasicArrow")}
              </a>
            )}
          </div>
        )}

        {/* Controls row: view toggle + navigation */}
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button onClick={() => navigate(-1)} className="btn-secondary p-2 flex-shrink-0">
            <ChevronRight className="w-4 h-4 ltr:-scale-x-100" />
          </button>
          <button onClick={goToToday} className="btn-secondary text-xs px-3 flex-shrink-0">
            {t("today")}
          </button>
          <button onClick={() => navigate(1)} className="btn-secondary p-2 flex-shrink-0">
            <ChevronLeft className="w-4 h-4 ltr:-scale-x-100" />
          </button>

          {/* View toggle — Week is tappable on mobile too (don't force a rotate to
              landscape, which is unreliable on Android PWAs). Only Month is hidden
              on mobile (too cramped on a phone). */}
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
                  mode.id === "month" && "hidden md:block",
                  viewMode === mode.id
                    ? "bg-brand-50 text-brand-600"
                    : "text-petra-muted hover:text-petra-text hover:bg-slate-50"
                )}
              >
                {t(`viewModes.${mode.id}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter: view lens + grouped category chips ── */}
      <div className="mb-4 px-1 space-y-2">
        {/* View-lens presets */}
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0 [&>*]:flex-shrink-0 [&>*]:whitespace-nowrap">
          <span className="text-[11px] text-petra-muted me-0.5">{t("viewLabel")}</span>
          {(() => {
            const lensEquals = (keys: CalCategory[]) =>
              keys.length === activeCategories.size && keys.every((k) => activeCategories.has(k));
            const lenses: { label: string; keys: CalCategory[] }[] = [
              { label: t("lenses.all"), keys: ALL_CAL_CATEGORIES },
              ...CAL_GROUPS.map((g) => ({
                label: g.key === "customer" ? t("lenses.customer") : g.key === "training" ? t("lenses.training") : t("lenses.mgmt"),
                keys: g.keys,
              })),
            ];
            return lenses.map((lens) => {
              const active = lensEquals(lens.keys);
              return (
                <button
                  key={lens.label}
                  onClick={() => setActiveCategories(new Set(lens.keys))}
                  className={cn(
                    "text-xs px-3 py-1 rounded-full border transition-all",
                    active
                      ? "border-petra-text font-medium shadow-sm bg-petra-text text-white"
                      : "border-petra-border hover:border-petra-text hover:bg-petra-bg text-petra-muted"
                  )}
                >
                  {lens.label}
                </button>
              );
            });
          })()}
        </div>

        {/* Grouped category chips (legend + filter in one) */}
        <div className="flex items-center gap-x-3 gap-y-2 flex-nowrap overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0 [&>*]:flex-shrink-0">
          {CAL_GROUPS.map((group, gi) => (
            <div key={group.key} className="flex items-center gap-1.5 whitespace-nowrap">
              {gi > 0 && <div className="w-px h-4 bg-petra-border me-1 hidden md:block" />}
              <span className="text-[10px] tracking-wide text-petra-muted/80">{t(`groups.${group.key}`)}</span>
              {group.keys.map((key) => {
                const def = CAL_CATEGORY_MAP[key];
                const isActive = activeCategories.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleCategory(key)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all",
                      isActive
                        ? "border-current font-medium shadow-sm"
                        : "border-transparent opacity-40 hover:opacity-70"
                    )}
                    style={{ color: isActive ? def.color : undefined }}
                    title={t("toggleCategoryTitle", { label: t(`categories.${def.key}`) })}
                  >
                    {key === "gcal" ? (
                      <span className="text-[9px] font-bold text-white rounded px-1 flex-shrink-0" style={{ background: def.color }}>G</span>
                    ) : (
                      <div
                        className={cn("w-2.5 h-2.5 flex-shrink-0", def.square ? "rounded-sm" : "rounded-full")}
                        style={{ background: def.color }}
                      />
                    )}
                    <span className={isActive ? "" : "text-petra-muted"}>{t(`categories.${def.key}`)}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Staff filter chips */}
          {staffList.length > 1 && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <div className="w-px h-4 bg-petra-border me-1 hidden md:block" />
              <span className="text-[10px] tracking-wide text-petra-muted/80">{t("staff")}</span>
              {staffList.map((s) => {
                const isActive = staffFilter.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() =>
                      setStaffFilter((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                      )
                    }
                    className={cn(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all",
                      isActive
                        ? "border-slate-600 font-medium bg-slate-700 text-white"
                        : "border-transparent hover:border-petra-border hover:bg-petra-bg text-petra-muted"
                    )}
                    title={t("filterByStaffTitle", { name: s.name })}
                  >
                    <div className="w-4 h-4 rounded-full bg-slate-400 flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                      {(s.name ?? "").charAt(0) || "?"}
                    </div>
                    <span>{(s.name ?? "").split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
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
                        "p-3 text-center border-s border-petra-border cursor-pointer hover:bg-slate-50/50 transition-colors",
                        isToday && "bg-brand-50/30"
                      )}
                      onClick={() => {
                        setSelectedDay(date);
                        setViewMode("day");
                      }}
                    >
                      <div className="text-xs text-petra-muted font-medium">
                        {t(`days.${DAY_IDS[i]}`)}
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
                        {allDayCollapsed ? "▸" : "▾"} {t("allDay", { count: allDayStays.length + weekAllDayTasks.length })}
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
                              marginInlineStart: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            title={t("stay.title", {
                              status: isCheckedIn ? t("stay.checkedIn") : t("stay.booked"),
                              pet: stay.pet.name,
                              room: stay.room?.name || t("stay.noRoom"),
                              checkIn: dateTimeToTime(stay.checkIn),
                              checkOut: stay.checkOut ? t("stay.checkOutSuffix", { time: dateTimeToTime(stay.checkOut) }) : "",
                            })}
                          >
                            <Hotel className="w-3 h-3 flex-shrink-0" />
                            {stay.pet.name} · {stay.room?.name || t("stay.noRoom")}
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
                              marginInlineStart: `${leftPct}%`,
                              width: `${widthPct}%`,
                              borderInlineStart: `3px solid ${color}`,
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
                      const isDropTarget = dropPreview?.date === dateStr;
                      return (
                        <div
                          key={dayIdx}
                          className={cn(
                            "border-s border-t border-slate-100 relative cursor-pointer hover:bg-slate-50/50 transition-colors",
                            isDropTarget && "bg-brand-50/40"
                          )}
                          onClick={() => {
                            if (dragging) return;
                            setModalDefaults({
                              date: dateStr,
                              time: `${String(hour).padStart(2, "0")}:00`,
                            });
                            setShowNewModal(true);
                          }}
                          onDragOver={(e) => handleGridDragOver(dateStr, e)}
                          onDrop={(e) => handleGridDrop(dateStr, e)}
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
                  const lanes = computeOverlapLanes(dayAppts);
                  return dayAppts.map((apt) => {
                    const { top, height } = appointmentStyle(
                      apt.startTime,
                      apt.endTime
                    );
                    const ln = lanes.get(apt.id) ?? { lane: 0, lanes: 1 };
                    return renderAppointmentBlock(
                      apt,
                      {
                        top,
                        height,
                        insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7 + ${ln.lane} * (100% - 60px) / 7 / ${ln.lanes})`,
                        width: `calc((100% - 60px) / 7 / ${ln.lanes} - 4px)`,
                        marginInlineStart: 2,
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
                        insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        marginInlineStart: 2,
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
                        insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        marginInlineStart: 2,
                      },
                      true
                    );
                  });
                })}

                {/* Lead follow-up blocks - week view */}
                {showLeads && weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const dayLeads = leadFollowUps.filter(
                    (l) => l.nextFollowUpAt.slice(0, 10) === dateStr
                  );
                  return dayLeads.map((lead) => {
                    const startTime = dateTimeToTime(lead.nextFollowUpAt);
                    const startMins = timeToMinutes(startTime);
                    if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                    const endTime = addMinutes(startTime, 30);
                    const { top, height } = appointmentStyle(startTime, endTime);
                    const overdueLead = isOverdue(lead.nextFollowUpAt);
                    return (
                      <a
                        key={`lead-fu-${lead.id}`}
                        href={`/leads`}
                        className={cn(
                          "absolute rounded-lg px-1.5 py-0.5 overflow-hidden flex flex-col justify-center hover:brightness-95 transition-all border",
                          overdueLead ? "border-red-400 bg-red-50" : "border-violet-300"
                        )}
                        style={{
                          top,
                          height: Math.max(height, 22),
                          insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                          width: `calc((100% - 60px) / 7 - 4px)`,
                          marginInlineStart: 2,
                          background: "#EDE9FE",
                          zIndex: 9,
                        }}
                        title={t("followUpTitleWithTime", { name: lead.name, service: lead.requestedService ? ` · ${lead.requestedService}` : "", time: startTime })}
                      >
                        <div className={cn("text-[10px] font-semibold truncate", overdueLead ? "text-red-600" : "text-violet-700")}>
                          {overdueLead ? "⚠️" : "📞"} {lead.name}
                        </div>
                        {lead.requestedService && (
                          <div className={cn("text-[9px] truncate", overdueLead ? "text-red-400" : "text-violet-500")}>{lead.requestedService}</div>
                        )}
                      </a>
                    );
                  });
                })}

                {/* Lead meeting blocks - week view */}
                {showLeads && weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  return leadMeetings
                    .filter((m) => m.date.slice(0, 10) === dateStr)
                    .map((m) => {
                      const startMins = timeToMinutes(m.startTime);
                      if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                      const { top, height } = appointmentStyle(m.startTime, m.endTime);
                      return (
                        <a
                          key={`lead-mtg-${m.id}`}
                          href="/leads"
                          className="absolute rounded-lg px-1.5 py-0.5 overflow-hidden flex flex-col justify-start hover:brightness-110 transition-all border"
                          style={{
                            top,
                            height,
                            insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                            width: `calc((100% - 60px) / 7 - 4px)`,
                            marginInlineStart: 2,
                            background: LEAD_MEETING_COLOR,
                            borderColor: LEAD_MEETING_COLOR,
                            zIndex: 9,
                          }}
                          title={leadMeetingTitle(m)}
                        >
                          <div className="text-[10px] font-semibold text-white truncate">
                            🤝 {leadMeetingLabel(m)}
                          </div>
                          <div className="text-[9px] text-white/80 truncate">
                            {m.startTime}–{m.endTime}{m.service ? ` · ${m.service.name}` : ""}
                          </div>
                        </a>
                      );
                    });
                })}

                {/* Boarding check-in / check-out timed blocks */}
                {weekDates.map((date, dayIdx) => {
                  const dateStr = toLocalDateString(date);
                  const checkIns = filteredBoardingStays.filter(
                    (s) => dateTimeToDateStr(s.checkIn) === dateStr
                  );
                  const checkOuts = filteredBoardingStays.filter(
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
                            insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                            width: `calc((100% - 60px) / 7 - 4px)`,
                            marginInlineStart: 2,
                            background: "#D1FAE5",
                            zIndex: 8,
                          }}
                          title={t("checkInTitle", { pet: stay.pet.name, customer: stay.customer.name, room: stay.room ? ` · ${stay.room.name}` : "", time: startTime })}
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
                            insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                            width: `calc((100% - 60px) / 7 - 4px)`,
                            marginInlineStart: 2,
                            background: "#FEF3C7",
                            zIndex: 8,
                          }}
                          title={t("checkOutTitle", { pet: stay.pet.name, customer: stay.customer.name, room: stay.room ? ` · ${stay.room.name}` : "", time: startTime })}
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
                  const gcalWeekTitle = `${ev.title}\n${ev.calendarName}\n${startTime}–${endTime}`;
                  const gcalWeekClass = "absolute rounded-lg px-1.5 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity";
                  const gcalWeekStyle: React.CSSProperties = {
                    top,
                    height: Math.max(height, 20),
                    insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                    width: `calc((100% - 60px) / 7 - 4px)`,
                    marginInlineStart: 2,
                    background: ev.backgroundColor,
                    borderColor: ev.backgroundColor,
                    zIndex: 5,
                  };
                  const gcalWeekContent = (
                    <>
                      <span className="absolute top-0.5 end-0.5 text-[8px] font-bold bg-white/80 rounded px-0.5" style={{ color: ev.backgroundColor }}>G</span>
                      <div className="text-[10px] font-semibold truncate text-white drop-shadow-sm">
                        {ev.title}
                      </div>
                    </>
                  );
                  return ev.htmlLink ? (
                    <a
                      key={ev.id}
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={gcalWeekTitle}
                      className={gcalWeekClass}
                      style={gcalWeekStyle}
                    >
                      {gcalWeekContent}
                    </a>
                  ) : (
                    <div key={ev.id} title={gcalWeekTitle} className={gcalWeekClass} style={gcalWeekStyle}>
                      {gcalWeekContent}
                    </div>
                  );
                })}

                {/* Training group sessions - week */}
                {showGroupSessions && trainingGroupSessions.filter((s) => s.status !== "CANCELED").map((s) => {
                  const dateStr = dateTimeToDateStr(s.sessionDatetime);
                  const dayIdx = weekDates.findIndex((d) => toLocalDateString(d) === dateStr);
                  if (dayIdx === -1) return null;
                  const startTime = dateTimeToTime(s.sessionDatetime);
                  const startMins = timeToMinutes(startTime);
                  if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                  const { top, height } = appointmentStyle(startTime, addMinutes(startTime, 60));
                  const isWorkshop = s.trainingGroup.groupType === "WORKSHOP";
                  const bg = isWorkshop ? "#EC4899" : "#8B5CF6";
                  return (
                    <a key={`tg-${s.id}`} href="/training"
                      title={`${s.trainingGroup.name} (${startTime})`}
                      className="absolute rounded-lg px-1.5 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity"
                      style={{ top, height: Math.max(height, 20), insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`, width: `calc((100% - 60px) / 7 - 4px)`, marginInlineStart: 2, background: bg, borderColor: bg, zIndex: 6 }}>
                      <div className="text-[10px] font-semibold truncate text-white drop-shadow-sm">{isWorkshop ? "🎓" : "👥"} {s.trainingGroup.name}</div>
                    </a>
                  );
                })}

                {/* Training program sessions - week */}
                {showProgramSessions && trainingProgramSessions.filter((s) => s.status !== "CANCELED").map((s) => {
                  const dateStr = dateTimeToDateStr(s.sessionDate);
                  const dayIdx = weekDates.findIndex((d) => toLocalDateString(d) === dateStr);
                  if (dayIdx === -1) return null;
                  const startTime = dateTimeToTime(s.sessionDate);
                  const startMins = timeToMinutes(startTime);
                  if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                  const { top, height } = appointmentStyle(startTime, addMinutes(startTime, s.durationMinutes || 60));
                  const label = s.program.dog?.name ?? s.program.name;
                  return (
                    <a key={`tp-${s.id}`} href="/training"
                      title={t("trainingTitleWithTime", { label, customer: s.program.customer ? " · " + s.program.customer.name : "", time: startTime })}
                      className="absolute rounded-lg px-1.5 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity"
                      style={{ top, height: Math.max(height, 20), insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`, width: `calc((100% - 60px) / 7 - 4px)`, marginInlineStart: 2, background: "#3B82F6", borderColor: "#3B82F6", zIndex: 6 }}>
                      <div className="text-[10px] font-semibold truncate text-white drop-shadow-sm">🐕 {label}</div>
                    </a>
                  );
                })}

                {/* Drop preview ghost */}
                {dragging && dropPreview && (() => {
                  const dayIdx = weekDates.findIndex((d) => toLocalDateString(d) === dropPreview.date);
                  if (dayIdx === -1) return null;
                  const previewTop = ((dropPreview.startMins - DAY_START) / 60) * SLOT_HEIGHT;
                  const previewHeight = (dragging.durationMins / 60) * SLOT_HEIGHT;
                  return (
                    <div
                      className="absolute rounded-lg border-2 border-dashed border-brand-500 bg-brand-100/40 pointer-events-none"
                      style={{
                        top: previewTop,
                        height: Math.max(previewHeight, 20),
                        insetInlineStart: `calc(60px + ${dayIdx} * (100% - 60px) / 7)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        marginInlineStart: 2,
                        zIndex: 15,
                      }}
                    />
                  );
                })()}

                {/* Current time indicator */}
                {currentTimeTop !== null && todayColumnIndex >= 0 && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: currentTimeTop,
                      insetInlineStart: `calc(60px + ${todayColumnIndex} * (100% - 60px) / 7)`,
                      width: `calc((100% - 60px) / 7)`,
                      zIndex: 20,
                    }}
                  >
                    <div className="absolute -top-[5px] start-[-5px] w-[10px] h-[10px] rounded-full bg-red-500" />
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
                {allDayCollapsed ? "▸" : "▾"} {t("allDay", { count: allDayStays.length + dayAllDayTasks.length })}
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
                        {stay.pet.name} · {stay.room?.name || t("stay.noRoom")} ·{" "}
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
                      style={{ borderInlineStart: `3px solid ${color}` }}
                    >
                      <ListTodo className="w-3.5 h-3.5 flex-shrink-0 text-petra-muted" />
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="truncate text-petra-text">{task.title}</span>
                      <span className="text-petra-muted ms-auto">
                        {taskCategoryLabel(task.category)}
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
                  className={cn(
                    "border-s border-t border-slate-100 relative cursor-pointer hover:bg-slate-50/50 transition-colors",
                    dropPreview?.date === toLocalDateString(selectedDay) && "bg-brand-50/40"
                  )}
                  onClick={() => {
                    if (dragging) return;
                    setModalDefaults({
                      date: toLocalDateString(selectedDay),
                      time: `${String(hour).padStart(2, "0")}:00`,
                    });
                    setShowNewModal(true);
                  }}
                  onDragOver={(e) => handleGridDragOver(toLocalDateString(selectedDay), e)}
                  onDrop={(e) => handleGridDrop(toLocalDateString(selectedDay), e)}
                />
              </div>
            ))}

            {/* Appointment blocks */}
            {(() => {
              const lanes = computeOverlapLanes(dayAppointments);
              return dayAppointments.map((apt) => {
                const { top, height } = appointmentStyle(
                  apt.startTime,
                  apt.endTime
                );
                const ln = lanes.get(apt.id) ?? { lane: 0, lanes: 1 };
                return renderAppointmentBlock(
                  apt,
                  {
                    top,
                    height,
                    insetInlineStart: `calc(60px + ${ln.lane} * (100% - 64px) / ${ln.lanes})`,
                    width: `calc((100% - 64px) / ${ln.lanes} - 2px)`,
                  },
                  false
                );
              });
            })()}

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
                  insetInlineStart: 60,
                  width: "calc(100% - 64px)",
                },
                false
              );
            })}

            {/* Lead follow-up blocks - day view */}
            {showLeads && leadFollowUps
              .filter((l) => l.nextFollowUpAt.slice(0, 10) === toLocalDateString(selectedDay))
              .map((lead) => {
                const startTime = dateTimeToTime(lead.nextFollowUpAt);
                const startMins = timeToMinutes(startTime);
                if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                const endTime = addMinutes(startTime, 30);
                const { top, height } = appointmentStyle(startTime, endTime);
                const overdueLead = isOverdue(lead.nextFollowUpAt);
                return (
                  <a
                    key={`lead-fu-day-${lead.id}`}
                    href="/leads"
                    className={cn(
                      "absolute rounded-lg px-2 py-1 overflow-hidden flex flex-col justify-center hover:brightness-95 transition-all border",
                      overdueLead ? "border-red-400" : "border-violet-300"
                    )}
                    style={{
                      top,
                      height: Math.max(height, 22),
                      insetInlineStart: 60,
                      width: "calc(100% - 64px)",
                      background: overdueLead ? "#FEF2F2" : "#EDE9FE",
                      zIndex: 9,
                    }}
                    title={t("followUpTitle", { name: lead.name, service: lead.requestedService ? ` · ${lead.requestedService}` : "" })}
                  >
                    <div className={cn("text-xs font-semibold truncate", overdueLead ? "text-red-600" : "text-violet-700")}>
                      {overdueLead ? t("overdueColon") : t("followUpColon")} {lead.name}
                    </div>
                    {lead.requestedService && (
                      <div className="text-[10px] text-violet-500 truncate">{lead.requestedService}</div>
                    )}
                    {lead.phone && (
                      <div className="text-[10px] text-violet-400 truncate">{lead.phone}</div>
                    )}
                  </a>
                );
              })}

            {/* Lead meeting blocks - day view */}
            {showLeads && leadMeetings
              .filter((m) => m.date.slice(0, 10) === toLocalDateString(selectedDay))
              .map((m) => {
                const startMins = timeToMinutes(m.startTime);
                if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
                const { top, height } = appointmentStyle(m.startTime, m.endTime);
                return (
                  <a
                    key={`lead-mtg-day-${m.id}`}
                    href="/leads"
                    className="absolute rounded-lg px-2 py-1 overflow-hidden flex flex-col justify-start hover:brightness-110 transition-all border"
                    style={{
                      top,
                      height,
                      insetInlineStart: 60,
                      width: "calc(100% - 64px)",
                      background: LEAD_MEETING_COLOR,
                      borderColor: LEAD_MEETING_COLOR,
                      zIndex: 9,
                    }}
                    title={leadMeetingTitle(m)}
                  >
                    <div className="text-xs font-semibold text-white truncate">
                      🤝 {leadMeetingLabel(m)}
                    </div>
                    <div className="text-[10px] text-white/80 truncate">
                      {m.startTime}–{m.endTime}{m.service ? ` · ${m.service.name}` : ""}
                    </div>
                    {(m.location || m.lead.phone) && (
                      <div className="text-[10px] text-white/70 truncate">
                        {[m.location, m.lead.phone].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </a>
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
                  { top, height, insetInlineStart: 60, width: "calc(100% - 64px)" },
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
              const gcalDayTitle = `${ev.title}\n${ev.calendarName}\n${startTime}–${endTime}`;
              const gcalDayClass = "absolute rounded-lg px-2 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity";
              const gcalDayStyle: React.CSSProperties = {
                top,
                height: Math.max(height, 22),
                insetInlineStart: 60,
                width: "calc(100% - 64px)",
                background: ev.backgroundColor,
                borderColor: ev.backgroundColor,
                zIndex: 5,
              };
              const gcalDayContent = (
                <>
                  <span className="absolute top-0.5 end-0.5 text-[8px] font-bold bg-white/80 rounded px-0.5" style={{ color: ev.backgroundColor }}>G</span>
                  <div className="text-xs font-semibold truncate text-white drop-shadow-sm">
                    {ev.title}
                  </div>
                  <div className="text-[10px] truncate text-white/80">
                    {ev.calendarName}
                  </div>
                </>
              );
              return ev.htmlLink ? (
                <a
                  key={ev.id}
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={gcalDayTitle}
                  className={gcalDayClass}
                  style={gcalDayStyle}
                >
                  {gcalDayContent}
                </a>
              ) : (
                <div key={ev.id} title={gcalDayTitle} className={gcalDayClass} style={gcalDayStyle}>
                  {gcalDayContent}
                </div>
              );
            })}

            {/* Training group sessions - day */}
            {showGroupSessions && trainingGroupSessions.filter((s) => s.status !== "CANCELED" && dateTimeToDateStr(s.sessionDatetime) === toLocalDateString(selectedDay)).map((s) => {
              const startTime = dateTimeToTime(s.sessionDatetime);
              const startMins = timeToMinutes(startTime);
              if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
              const { top, height } = appointmentStyle(startTime, addMinutes(startTime, 60));
              const isWorkshop = s.trainingGroup.groupType === "WORKSHOP";
              const bg = isWorkshop ? "#EC4899" : "#8B5CF6";
              return (
                <a key={`tg-day-${s.id}`} href="/training"
                  title={`${s.trainingGroup.name} (${startTime})`}
                  className="absolute rounded-lg px-2 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity"
                  style={{ top, height: Math.max(height, 22), insetInlineStart: 60, width: "calc(100% - 64px)", background: bg, borderColor: bg, zIndex: 6 }}>
                  <div className="text-xs font-semibold truncate text-white drop-shadow-sm">{isWorkshop ? "🎓" : "👥"} {s.trainingGroup.name}</div>
                  {s.trainingGroup.location && <div className="text-[10px] truncate text-white/80">{s.trainingGroup.location}</div>}
                </a>
              );
            })}

            {/* Training program sessions - day */}
            {showProgramSessions && trainingProgramSessions.filter((s) => s.status !== "CANCELED" && dateTimeToDateStr(s.sessionDate) === toLocalDateString(selectedDay)).map((s) => {
              const startTime = dateTimeToTime(s.sessionDate);
              const startMins = timeToMinutes(startTime);
              if (startMins < DAY_START || startMins >= DAY_START + 13 * 60) return null;
              const { top, height } = appointmentStyle(startTime, addMinutes(startTime, s.durationMinutes || 60));
              const label = s.program.dog?.name ?? s.program.name;
              return (
                <a key={`tp-day-${s.id}`} href="/training"
                  title={t("trainingTitle", { label, customer: s.program.customer ? " · " + s.program.customer.name : "" })}
                  className="absolute rounded-lg px-2 py-0.5 overflow-hidden border flex flex-col justify-center hover:opacity-90 transition-opacity"
                  style={{ top, height: Math.max(height, 22), insetInlineStart: 60, width: "calc(100% - 64px)", background: "#3B82F6", borderColor: "#3B82F6", zIndex: 6 }}>
                  <div className="text-xs font-semibold truncate text-white drop-shadow-sm">🐕 {label}</div>
                  {s.program.customer && <div className="text-[10px] truncate text-white/80">{s.program.customer.name}</div>}
                </a>
              );
            })}

            {/* Drop preview ghost - day view */}
            {dragging && dropPreview?.date === toLocalDateString(selectedDay) && (() => {
              const previewTop = ((dropPreview.startMins - DAY_START) / 60) * SLOT_HEIGHT;
              const previewHeight = (dragging.durationMins / 60) * SLOT_HEIGHT;
              return (
                <div
                  className="absolute rounded-lg border-2 border-dashed border-brand-500 bg-brand-100/40 pointer-events-none"
                  style={{
                    top: previewTop,
                    height: Math.max(previewHeight, 22),
                    insetInlineStart: 60,
                    width: "calc(100% - 64px)",
                    zIndex: 15,
                  }}
                />
              );
            })()}

            {/* Current time indicator */}
            {currentTimeTop !== null && (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: currentTimeTop,
                  insetInlineStart: 0,
                  width: "100%",
                  zIndex: 20,
                }}
              >
                <div className="absolute -top-[5px] start-[55px] w-[10px] h-[10px] rounded-full bg-red-500" />
                <div
                  className="h-[2px] bg-red-500"
                  style={{ marginInlineStart: 60 }}
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
            {DAY_IDS.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-petra-muted"
              >
                {t(`days.${day}`)}
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
              dayTsk.forEach((task) => {
                const time = task.dueAt ? dateTimeToTime(task.dueAt) : "";
                entries.push({
                  key: `tsk-${task.id}`,
                  color: TASK_PRIORITY_COLORS[task.priority] || "#9CA3AF",
                  label: `${time ? time + " " : ""}${task.title}`,
                });
              });
              // Add GCal events to month view
              if (showGcal) {
                const dayGcal = gcalEvents.filter((e) => !e.isAllDay && e.start.slice(0, 10) === dateStr);
                dayGcal.forEach((ev) => {
                  const time = dateTimeToTime(ev.start);
                  entries.push({
                    key: `gcal-${ev.id}`,
                    color: ev.backgroundColor,
                    label: `${time} ${ev.title}`,
                  });
                });
              }

              // Lead meetings - month
              if (showLeads) {
                leadMeetings
                  .filter((m) => m.date.slice(0, 10) === dateStr)
                  .forEach((m) => {
                    entries.push({
                      key: `lead-mtg-${m.id}`,
                      color: LEAD_MEETING_COLOR,
                      label: `${m.startTime} ${leadMeetingLabel(m)}`,
                      onClick: (e) => { e.stopPropagation(); window.location.href = "/leads"; },
                    });
                  });
              }

              // Training group sessions - month
              if (showGroupSessions) {
                trainingGroupSessions
                  .filter((s) => s.status !== "CANCELED" && dateTimeToDateStr(s.sessionDatetime) === dateStr)
                  .forEach((s) => {
                    const isWorkshop = s.trainingGroup.groupType === "WORKSHOP";
                    entries.push({
                      key: `tg-${s.id}`,
                      color: isWorkshop ? "#EC4899" : "#8B5CF6",
                      label: `${dateTimeToTime(s.sessionDatetime)} ${s.trainingGroup.name}`,
                      onClick: (e) => { e.stopPropagation(); window.location.href = "/training"; },
                    });
                  });
              }

              // Training program sessions - month
              if (showProgramSessions) {
                trainingProgramSessions
                  .filter((s) => s.status !== "CANCELED" && dateTimeToDateStr(s.sessionDate) === dateStr)
                  .forEach((s) => {
                    entries.push({
                      key: `tp-${s.id}`,
                      color: "#3B82F6",
                      label: `${dateTimeToTime(s.sessionDate)} ${s.program.dog?.name ?? s.program.name}`,
                      onClick: (e) => { e.stopPropagation(); window.location.href = "/training"; },
                    });
                  });
              }

              const shown = entries.slice(0, 3);
              const overflow = entries.length - 3;

              return (
                <div
                  key={idx}
                  className={cn(
                    "group min-h-[72px] md:min-h-[96px] p-2 border-b border-s border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors",
                    !isCurrentMonth && "bg-slate-50/30"
                  )}
                  onClick={() => {
                    setSelectedDay(date);
                    setViewMode("day");
                    setAnchor(date);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalDefaults({ date: dateStr, time: "09:00" });
                        setShowNewModal(true);
                      }}
                      className="p-0.5 rounded-full text-petra-muted/60 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 hover:text-brand-600 hover:bg-brand-50 transition-opacity"
                      title={t("addOnDay")}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
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
                        <div className="text-[10px] text-petra-muted font-medium ps-3">
                          {t("moreCount", { count: overflow })}
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

      {/* ═══════════════ AGENDA VIEW ═══════════════ */}
      {viewMode === "agenda" && (() => {
        interface AgendaItem {
          key: string;
          time: string;
          sortKey: string;
          title: string;
          subtitle: string;
          color: string;
          href?: string;
          icon: string;
          overdue?: boolean;
          appointment?: AppointmentEvent;
          customerHref?: string;
        }
        const agendaDays = weekDates.map((date) => {
          const dateStr = toLocalDateString(date);
          const items: AgendaItem[] = [];

          filteredAppointments
            .filter((a) => a.date.slice(0, 10) === dateStr && a.status !== "canceled")
            .forEach((a) => items.push({
              key: `apt-${a.id}`,
              time: a.startTime,
              sortKey: a.startTime,
              title: a.pet ? `${a.pet.name} — ${a.customer.name}` : a.customer.name,
              subtitle: aptLabel(a),
              color: getAppointmentColor(a.service, a.priceListItem),
              icon: "📅",
              appointment: a,
              customerHref: `/customers/${a.customer.id}`,
            }));

          tasks
            .filter((tk) => tk.dueAt && dateTimeToDateStr(tk.dueAt) === dateStr)
            .forEach((tk) => {
              const overdue = !!(tk.dueAt && isOverdue(tk.dueAt) && tk.status !== "COMPLETED");
              items.push({
                key: `task-${tk.id}`,
                time: dateTimeToTime(tk.dueAt!),
                sortKey: dateTimeToTime(tk.dueAt!),
                title: tk.title,
                subtitle: taskCategoryLabel(tk.category),
                color: overdue ? "#EF4444" : (TASK_PRIORITY_COLORS[tk.priority] || "#9CA3AF"),
                href: "/tasks",
                icon: overdue ? "⚠️" : "✅",
                overdue,
              });
            });

          if (showLeads) {
            leadFollowUps
              .filter((l) => l.nextFollowUpAt.slice(0, 10) === dateStr)
              .forEach((l) => {
                const overdue = isOverdue(l.nextFollowUpAt);
                items.push({
                  key: `lead-${l.id}`,
                  time: dateTimeToTime(l.nextFollowUpAt),
                  sortKey: dateTimeToTime(l.nextFollowUpAt),
                  title: l.name,
                  subtitle: l.requestedService || t("agenda.salesFollowUp"),
                  color: overdue ? "#EF4444" : "#8B5CF6",
                  href: "/leads",
                  icon: overdue ? "⚠️" : "📞",
                  overdue,
                });
              });
            leadMeetings
              .filter((m) => m.date.slice(0, 10) === dateStr)
              .forEach((m) => {
                items.push({
                  key: `lead-mtg-${m.id}`,
                  time: m.startTime,
                  sortKey: m.startTime,
                  title: leadMeetingLabel(m),
                  subtitle: m.service ? m.service.name : t("agenda.meetingUntil", { time: m.endTime }),
                  color: LEAD_MEETING_COLOR,
                  href: "/leads",
                  icon: "🤝",
                });
              });
          }

          if (showGcal) {
            gcalEvents
              .filter((e) => !e.isAllDay && e.start.slice(0, 10) === dateStr)
              .forEach((e) => items.push({
                key: `gcal-${e.id}`,
                time: dateTimeToTime(e.start),
                sortKey: dateTimeToTime(e.start),
                title: e.title,
                subtitle: e.calendarName,
                color: e.backgroundColor,
                href: e.htmlLink,
                icon: "G",
              }));
          }

          if (showGroupSessions) {
            trainingGroupSessions
              .filter((s) => s.status !== "CANCELED" && dateTimeToDateStr(s.sessionDatetime) === dateStr)
              .forEach((s) => {
                const time = dateTimeToTime(s.sessionDatetime);
                const isWorkshop = s.trainingGroup.groupType === "WORKSHOP";
                items.push({
                  key: `tg-${s.id}`,
                  time,
                  sortKey: time,
                  title: s.trainingGroup.name,
                  subtitle: isWorkshop ? t("agenda.workshop") : t("agenda.groupTraining"),
                  color: isWorkshop ? "#EC4899" : "#8B5CF6",
                  href: "/training",
                  icon: isWorkshop ? "🎓" : "👥",
                });
              });
          }

          if (showProgramSessions) {
            trainingProgramSessions
              .filter((s) => s.status !== "CANCELED" && dateTimeToDateStr(s.sessionDate) === dateStr)
              .forEach((s) => {
                const time = dateTimeToTime(s.sessionDate);
                const label = s.program.dog?.name ?? s.program.name;
                items.push({
                  key: `tp-${s.id}`,
                  time,
                  sortKey: time,
                  title: label,
                  subtitle: s.program.customer ? t("agenda.trainingWith", { name: s.program.customer.name }) : t("agenda.training"),
                  color: "#3B82F6",
                  href: "/training",
                  icon: "🐕",
                });
              });
          }

          items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
          return { date, dateStr, items };
        });

        return (
          <div
            className="card divide-y divide-petra-border"
            onPointerDownCapture={(e) => { agendaPointerDown.current = { x: e.clientX, y: e.clientY }; }}
            onClickCapture={(e) => {
              // If the pointer moved more than a small threshold between press and
              // release, treat it as a scroll/drag — not a tap — and swallow the
              // click so we don't navigate to day view / a customer by accident.
              const start = agendaPointerDown.current;
              if (start && (Math.abs(e.clientX - start.x) > 10 || Math.abs(e.clientY - start.y) > 10)) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {agendaDays.map(({ date, dateStr, items }) => {
              const isToday = dateStr === today;
              return (
                <div key={dateStr} className={cn("", isToday && "bg-brand-50/20")}>
                  <div
                    className={cn(
                      "flex items-center justify-between px-4 py-2 text-sm font-semibold sticky top-0 bg-white border-b border-petra-border cursor-pointer hover:bg-slate-50 transition-colors",
                      isToday && "text-brand-600"
                    )}
                    onClick={() => { setSelectedDay(date); setViewMode("day"); }}
                  >
                    <span className="min-w-0 truncate">
                      {date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                      {items.length > 0 && <span className="ms-2 text-xs font-normal text-petra-muted">{t("agenda.eventsCount", { count: items.length })}</span>}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalDefaults({ date: dateStr, time: "09:00" });
                        setShowNewModal(true);
                      }}
                      className="p-1 rounded-full text-petra-muted hover:text-brand-600 hover:bg-brand-50 transition-colors flex-shrink-0"
                      title={t("addOnDay")}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-petra-muted">{t("agenda.noEvents")}</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {items.map((item) => {
                        const rowClass = "flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors";
                        const rowContent = (
                          <>
                            <div className="w-12 text-xs font-mono text-petra-muted text-end flex-shrink-0">{item.time}</div>
                            <div
                              className="w-1 self-stretch rounded-full flex-shrink-0"
                              style={{ background: item.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className={cn("text-sm font-medium truncate", item.overdue && "text-red-600")}>{item.title}</div>
                              <div className="text-xs text-petra-muted truncate">{item.subtitle}</div>
                            </div>
                            {item.appointment && (
                              <a
                                href={item.customerHref}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-brand-600 hover:underline flex-shrink-0"
                              >
                                {t("agenda.customerCard")}
                              </a>
                            )}
                            {item.icon === "G" ? (
                              <span className="text-[9px] font-bold bg-[#4285F4] text-white rounded px-1 flex-shrink-0">G</span>
                            ) : (
                              <span className="text-sm flex-shrink-0">{item.icon}</span>
                            )}
                          </>
                        );
                        if (item.appointment) {
                          // Appointments open the same detail modal as day/week/month views
                          const apt = item.appointment;
                          return (
                            <div
                              key={item.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedAppointment(apt)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedAppointment(apt); } }}
                              className={cn(rowClass, "cursor-pointer")}
                            >
                              {rowContent}
                            </div>
                          );
                        }
                        if (!item.href) {
                          return (
                            <div key={item.key} className={rowClass}>
                              {rowContent}
                            </div>
                          );
                        }
                        return (
                          <a key={item.key} href={item.href} className={rowClass}>
                            {rowContent}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

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
            onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setConfirmDeleteId(null); setCancellationNote(""); setEditingNotes(false); }}
          />
          <div className="modal-content max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <a
                  href={`/customers/${selectedAppointment.customer.id}`}
                  className="text-lg font-bold text-petra-text hover:text-brand-600 transition-colors"
                  onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setConfirmDeleteId(null); setCancellationNote(""); setEditingNotes(false); }}
                >
                  {selectedAppointment.customer.name}
                </a>
                <p className="text-xs text-petra-muted mt-0.5">
                  {new Date(selectedAppointment.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <button
                onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setConfirmDeleteId(null); setCancellationNote(""); setEditingNotes(false); }}
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
                {aptLabel(selectedAppointment)}
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
                      placeholder={t("detail.notesPlaceholder")}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn-primary text-xs py-1.5 flex-1 flex items-center justify-center gap-1"
                        disabled={notesMutation.isPending}
                        onClick={() => notesMutation.mutate({ id: selectedAppointment.id, notes: notesInput })}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {notesMutation.isPending ? tc("progress.saving") : t("detail.saveNotes")}
                      </button>
                      <button
                        className="btn-secondary text-xs py-1.5 px-3"
                        onClick={() => { setEditingNotes(false); setNotesInput(selectedAppointment.notes ?? ""); }}
                      >
                        {tc("actions.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    {selectedAppointment.notes ? (
                      <p className="text-petra-muted flex-1">{selectedAppointment.notes}</p>
                    ) : (
                      <p className="text-petra-muted/50 text-xs italic flex-1">{t("detail.noNotes")}</p>
                    )}
                    <button
                      className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-brand-500 hover:bg-slate-100 transition-colors flex-shrink-0 md:opacity-0 md:group-hover/notes:opacity-100"
                      title={t("detail.editNotes")}
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
                <p className="text-xs font-medium text-red-600 mb-0.5">{t("detail.cancellationReason")}</p>
                <p className="text-xs text-red-700">{selectedAppointment.cancellationNote}</p>
              </div>
            )}
            {/* WhatsApp reminder */}
            <a
              href={(() => {
                const appt = selectedAppointment;
                const date = new Date(appt.date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }); // i18n-ok — customer WhatsApp text (Phase 3)
                const msg = `שלום ${appt.customer.name}! 😊\nתזכורת לתור שלך:\n📅 ${date} בשעה ${appt.startTime}\n🐾 ${getAppointmentLabel(appt, "תור")}${appt.pet ? ` עם ${appt.pet.name}` : ""}\n\nנתראה! 🌟`; // i18n-ok — customer WhatsApp text (Phase 3)
                return `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(appt.customer.phone)}&text=${encodeURIComponent(msg)}`;
              })()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {t("detail.sendWhatsappReminder")}
            </a>

            {/* Reschedule form */}
            {rescheduling && (
              <div className="mt-3 p-3 rounded-xl bg-brand-50 border border-brand-100 space-y-3">
                <p className="text-xs font-semibold text-brand-700">{t("detail.reschedule")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-[10px]">{t("detail.date")}</label>
                    <input
                      type="date" lang={cfg.lang}
                      className="input text-xs py-1.5"
                      value={rescheduleForm.date}
                      onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label text-[10px]">{t("detail.startTime")}</label>
                    <input
                      type="time"
                      className="input text-xs py-1.5"
                      value={rescheduleForm.startTime}
                      onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                    />
                  </div>
                </div>
                {(() => {
                  const origDur = Math.max(
                    timeToMinutes(selectedAppointment.endTime) - timeToMinutes(selectedAppointment.startTime),
                    15
                  );
                  const newEnd = rescheduleForm.startTime ? addMinutes(rescheduleForm.startTime, origDur) : "";
                  return (
                    <p className="text-[10px] text-brand-600">
                      {t("detail.durationKept", { minutes: origDur })}{newEnd ? t("detail.endSuffix", { time: newEnd }) : ""}
                    </p>
                  );
                })()}
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1 text-xs"
                    disabled={rescheduleMutation.isPending || !rescheduleForm.date || !rescheduleForm.startTime}
                    onClick={() => {
                      // Preserve the original DURATION, not the original end time:
                      // recompute endTime = newStart + (original endTime - original startTime)
                      const origDur = Math.max(
                        timeToMinutes(selectedAppointment.endTime) - timeToMinutes(selectedAppointment.startTime),
                        15
                      );
                      rescheduleMutation.mutate({
                        id: selectedAppointment.id,
                        date: rescheduleForm.date,
                        startTime: rescheduleForm.startTime,
                        endTime: addMinutes(rescheduleForm.startTime, origDur),
                      });
                    }}
                  >
                    {rescheduleMutation.isPending ? tc("progress.saving") : t("detail.confirmMove")}
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => setRescheduling(false)}>{tc("actions.cancel")}</button>
                </div>
              </div>
            )}

            {selectedAppointment.status === "scheduled" && (
              <button
                onClick={() => duplicateMutation.mutate(selectedAppointment)}
                disabled={duplicateMutation.isPending}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                {duplicateMutation.isPending ? t("detail.duplicating") : t("detail.duplicate")}
              </button>
            )}

            {selectedAppointment.orderId && (
              <a
                href={`/orders/${selectedAppointment.orderId}`}
                onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setConfirmDeleteId(null); setCancellationNote(""); setEditingNotes(false); }}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t("detail.openOrder")}
              </a>
            )}

            <a
              href={`/customers/${selectedAppointment.customer.id}`}
              onClick={() => { setSelectedAppointment(null); setConfirmCancelId(null); setConfirmDeleteId(null); setCancellationNote(""); setEditingNotes(false); }}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("detail.customerCard")}
            </a>

            <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-slate-100">
              {confirmDeleteId === selectedAppointment.id ? (
                <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
                  <span className="text-xs text-red-700 flex-1">{t("detail.deleteConfirm")}</span>
                  <button
                    className="text-xs font-semibold text-red-600 hover:text-red-800"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selectedAppointment.id)}
                  >
                    {deleteMutation.isPending ? "..." : t("detail.yesDelete")}
                  </button>
                  <button
                    className="text-xs text-petra-muted hover:text-petra-text"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    {t("detail.no")}
                  </button>
                </div>
              ) : confirmCancelId === selectedAppointment.id ? (
                <div className="flex-1 flex flex-col gap-2 bg-red-50 rounded-xl px-3 py-2">
                  <span className="text-xs font-semibold text-red-700">{t("detail.cancelConfirm")}</span>
                  <input
                    type="text"
                    className="input text-xs py-1"
                    placeholder={t("detail.cancelReasonPlaceholder")}
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
                      {t("detail.yesCancel")}
                    </button>
                    <button
                      className="text-xs text-petra-muted hover:text-petra-text"
                      onClick={() => { setConfirmCancelId(null); setCancellationNote(""); }}
                    >
                      {t("detail.no")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selectedAppointment.status === "scheduled" && selectedAppointment.customer.phone && can("whatsapp_reminders") && canSendMessages && (
                    <button
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 border border-transparent hover:border-green-200 transition-colors flex-shrink-0"
                      disabled={remindMutation.isPending}
                      onClick={() => remindMutation.mutate(selectedAppointment.id)}
                      title={t("detail.sendReminderTitle")}
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
                      {t("detail.completed")}
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
                      title={t("detail.reschedule")}
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {selectedAppointment.status === "scheduled" && (
                    <button
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-amber-500 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors flex-shrink-0"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: selectedAppointment.id, status: "no_show" })}
                      title={t("detail.noShow")}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                  {selectedAppointment.status === "scheduled" && (
                    <button
                      className="btn-danger flex-1 text-xs"
                      onClick={() => setConfirmCancelId(selectedAppointment.id)}
                    >
                      {t("detail.cancelAppointment")}
                    </button>
                  )}
                  {selectedAppointment.status === "completed" && (
                    <>
                      <button
                        className="btn-secondary flex-1 text-xs"
                        onClick={() => setShowQuickPayment(true)}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        {t("detail.addPayment")}
                      </button>
                      {selectedAppointment.customer.phone && (
                        <a
                          href={(() => {
                            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
                            const bookingUrl = `${baseUrl}/book/${user?.businessSlug || user?.businessId || ""}`;
                            const msg = `שלום ${selectedAppointment.customer.name}! 😊\nתודה על הביקור! מוזמנ/ת לקבוע את התור הבא:\n${bookingUrl}\nנתראה! 🐾`; // i18n-ok — customer WhatsApp text (Phase 3)
                            return `https://api.whatsapp.com/send?phone=${toWhatsAppPhone(selectedAppointment.customer.phone)}&text=${encodeURIComponent(msg)}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 border border-transparent hover:border-green-200 transition-colors flex-shrink-0"
                          title={t("detail.sendNextLinkTitle")}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                    </>
                  )}
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors flex-shrink-0"
                    onClick={() => setConfirmDeleteId(selectedAppointment.id)}
                    title={t("detail.deleteAppointment")}
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
