"use client";

import { BookingsTabs } from "@/components/bookings/BookingsTabs";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  UserPlus,
  MessageCircle,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";
import {
  cn,
  fetchJSON,
  formatCurrency,
  formatDate,
  toWhatsAppPhone,
  copyToClipboard,
} from "@/lib/utils";
import { TierGate } from "@/components/paywall/TierGate";
import { useAuth } from "@/providers/auth-provider";

/* ─────────────── Types ─────────────── */

interface AvailabilityRule {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface Service {
  id: string;
  name: string;
  type: string;
  duration: number;
  price: number;
  color: string | null;
  isActive: boolean;
}

interface PriceListItem {
  id: string;
  name: string;
  durationMinutes: number | null;
  basePrice: number;
  isActive: boolean;
  category: string | null;
}

// Unified option shown in the service dropdown
interface ServiceOption {
  id: string;
  name: string;
  duration: number;
  price: number;
  isActive: boolean;
  source: "service" | "price-list";
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  pets: Pet[];
}

interface BookingResult {
  appointmentId: string;
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  price: number;
  phone: string;
}

/* ─────────────── Constants ─────────────── */

const HEBREW_DAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HEBREW_DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const DEFAULT_RULES: AvailabilityRule[] = [
  { dayOfWeek: 0, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 3, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 4, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { dayOfWeek: 5, isOpen: false, openTime: "09:00", closeTime: "14:00" },
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "18:00" },
];

/* ─────────────── Helpers ─────────────── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function formatHebDate(dateString: string): string {
  const d = new Date(dateString + "T00:00:00");
  return formatDate(d);
}

/* ─────────────── Main Page ─────────────── */

export default function SchedulerPage() {
  return (
    <TierGate
      feature="online_bookings"
      title="ניהול תורים אונליין"
      description="אפשר ללקוחות לקבוע תורים בעצמם — זמין במנוי בייסיק ומעלה."
    >
      <SchedulerContent />
    </TierGate>
  );
}

function SchedulerContent() {
  const queryClient = useQueryClient();
  const today = todayStr();
  const searchParams = useSearchParams();
  const prefilledCustomerId = searchParams.get("customerId");
  const { user } = useAuth();
  const [origin, setOrigin] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const bookingLink = `${origin}/book/${user?.businessSlug || ""}`;

  function copyLink() {
    copyToClipboard(bookingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  /* ── State ── */
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [notes, setNotes] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  /* ── Queries ── */
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => fetchJSON("/api/services"),
  });

  const { data: priceListItems = [] } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items-for-scheduler"],
    queryFn: () => fetchJSON("/api/price-list-items"),
  });

  // Merge Services + PriceListItems into a single unified list
  const activeServices = useMemo<ServiceOption[]>(() => {
    const fromServices: ServiceOption[] = services
      .filter((s) => s.isActive)
      .map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price, isActive: true, source: "service" as const }));
    const fromPriceList: ServiceOption[] = priceListItems
      .filter((p) => p.isActive)
      .map((p) => ({ id: p.id, name: p.name, duration: p.durationMinutes ?? 60, price: p.basePrice, isActive: true, source: "price-list" as const }));
    return [...fromServices, ...fromPriceList];
  }, [services, priceListItems]);

  const { data: rawRules } = useQuery<AvailabilityRule[]>({
    queryKey: ["availability-rules"],
    queryFn: () => fetchJSON("/api/booking/availability"),
  });

  const rules = useMemo(() => {
    if (!rawRules || rawRules.length === 0) return DEFAULT_RULES;
    return rawRules;
  }, [rawRules]);

  const rulesMap = useMemo(() => {
    const m = new Map<number, AvailabilityRule>();
    rules.forEach((r) => m.set(r.dayOfWeek, r));
    return m;
  }, [rules]);

  const selectedService = activeServices.find((s) => s.id === selectedServiceId);

  const { data: slots = [], isLoading: slotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["booking-slots", selectedDate, selectedServiceId],
    queryFn: () => {
      const param = selectedService?.source === "price-list"
        ? `priceListItemId=${selectedServiceId}`
        : `serviceId=${selectedServiceId}`;
      return fetchJSON(`/api/booking/slots?date=${selectedDate}&${param}`);
    },
    enabled: !!selectedDate && !!selectedServiceId,
  });

  // Filter past slots for today
  const filteredSlots = useMemo(() => {
    if (selectedDate !== today) return slots;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return slots.map((s) => {
      const [h, m] = s.time.split(":").map(Number);
      if (h * 60 + m <= nowMins) return { ...s, available: false };
      return s;
    });
  }, [slots, selectedDate, today]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-for-scheduler"],
    queryFn: () => fetchJSON("/api/customers?full=1"),
  });

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  // Auto-select customer from URL param
  useEffect(() => {
    if (prefilledCustomerId && customers.length > 0 && !selectedCustomerId) {
      const customer = customers.find((c) => c.id === prefilledCustomerId);
      if (customer) {
        setSelectedCustomerId(customer.id);
        setCustomerSearch(customer.name);
      }
    }
  }, [prefilledCustomerId, customers, selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  /* ── Mutations ── */
  const createAppointment = useMutation<Record<string, unknown>, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetchJSON<Record<string, unknown>>("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["booking-slots"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setBookingResult({
        appointmentId: result.id as string,
        customerName: selectedCustomer?.name || newCustomerName,
        serviceName: selectedService?.name || "",
        date: selectedDate,
        time: selectedTime,
        price: selectedService?.price || 0,
        phone: selectedCustomer?.phone || newCustomerPhone,
      });
    },
  });

  const createCustomer = useMutation({
    mutationFn: (data: { name: string; phone: string }) =>
      fetchJSON<Customer>("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customers-for-scheduler"] });
      setSelectedCustomerId(result.id);
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
    },
  });

  /* ── Handlers ── */
  function handleServiceChange(serviceId: string) {
    setSelectedServiceId(serviceId);
    setSelectedTime(""); // reset time when service changes
  }

  function handleDateSelect(day: number) {
    const ds = dateStr(calMonth.year, calMonth.month, day);
    setSelectedDate(ds);
    setSelectedTime(""); // reset time when date changes
  }

  function handleBook() {
    if (!selectedDate || !selectedTime || !selectedServiceId) return;

    const customerId = selectedCustomerId;
    if (!customerId && !showNewCustomer) return;

    const endTime = selectedService
      ? addMinutes(selectedTime, selectedService.duration)
      : addMinutes(selectedTime, 30);

    const isPriceList = selectedService?.source === "price-list";
    const servicePayload = isPriceList
      ? { priceListItemId: selectedServiceId }
      : { serviceId: selectedServiceId };

    if (showNewCustomer && !selectedCustomerId) {
      // First create the customer, then book
      createCustomer.mutate(
        { name: newCustomerName, phone: newCustomerPhone },
        {
          onSuccess: (newCust) => {
            createAppointment.mutate({
              date: selectedDate,
              startTime: selectedTime,
              endTime,
              ...servicePayload,
              customerId: newCust.id,
              petId: selectedPetId || undefined,
              notes: notes || undefined,
            });
          },
        }
      );
      return;
    }

    createAppointment.mutate({
      date: selectedDate,
      startTime: selectedTime,
      endTime,
      ...servicePayload,
      customerId,
      petId: selectedPetId || undefined,
      notes: notes || undefined,
    });
  }

  function resetAll() {
    setSelectedDate("");
    setSelectedTime("");
    setSelectedServiceId("");
    setSelectedCustomerId("");
    setSelectedPetId("");
    setNotes("");
    setBookingResult(null);
    setCustomerSearch("");
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
  }

  const isBookable =
    selectedDate &&
    selectedTime &&
    selectedServiceId &&
    (selectedCustomerId || (showNewCustomer && newCustomerName.trim() && newCustomerPhone.trim()));

  const isSubmitting = createAppointment.isPending || createCustomer.isPending;

  /* ─────────────── Success State ─────────────── */
  if (bookingResult) {
    const waPhone = toWhatsAppPhone(bookingResult.phone);
    const waMsg = encodeURIComponent(
      `שלום ${bookingResult.customerName}! התור שלך ל${bookingResult.serviceName} נקבע ל${formatHebDate(bookingResult.date)} בשעה ${bookingResult.time}. סה״כ: ${formatCurrency(bookingResult.price)}. תודה! 🐾`
    );
    return (
      <div className="p-6 max-w-xl mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">התור נקבע בהצלחה!</h2>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700 mt-4 text-right">
            <div className="flex justify-between">
              <span className="font-medium">{bookingResult.serviceName}</span>
              <span className="text-gray-500">שירות</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{bookingResult.customerName}</span>
              <span className="text-gray-500">לקוח</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{formatHebDate(bookingResult.date)}</span>
              <span className="text-gray-500">תאריך</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">{bookingResult.time}</span>
              <span className="text-gray-500">שעה</span>
            </div>
            {bookingResult.price > 0 && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-bold text-gray-900">
                  {formatCurrency(bookingResult.price)}
                </span>
                <span className="text-gray-500">מחיר</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-6">
            {bookingResult.phone && (
              <a
                href={`https://wa.me/${waPhone}?text=${waMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium transition-colors"
                style={{ background: "#25D366" }}
              >
                <MessageCircle className="w-4 h-4" />
                שלח הודעת WhatsApp
              </a>
            )}
            <button
              onClick={resetAll}
              className="btn-secondary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl"
            >
              <Plus className="w-4 h-4" />
              קבע תור נוסף
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── Calendar helpers ─────────────── */
  const monthCells = getMonthDays(calMonth.year, calMonth.month);
  const monthLabel = new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(new Date(calMonth.year, calMonth.month, 1));

  function prevMonth() {
    setCalMonth((p) => {
      const m = p.month - 1;
      return m < 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: m };
    });
  }

  function nextMonth() {
    setCalMonth((p) => {
      const m = p.month + 1;
      return m > 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: m };
    });
  }

  function isDayClosed(day: number) {
    const d = new Date(calMonth.year, calMonth.month, day);
    const dow = d.getDay();
    const rule = rulesMap.get(dow);
    return rule ? !rule.isOpen : false;
  }

  function isDayPast(day: number) {
    const ds = dateStr(calMonth.year, calMonth.month, day);
    return ds < today;
  }

  /* ─────────────── Render ─────────────── */
  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in">
      <BookingsTabs />
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">תורים</h1>
          <p className="text-sm text-gray-500">קביעת תורים ללקוחות</p>
        </div>
        <div className="mr-auto">
          <button onClick={copyLink} className="btn-secondary flex items-center gap-2">
            <Copy className="w-4 h-4" />
            {copiedLink ? "הועתק!" : "העתק קישור הזמנה"}
          </button>
        </div>
      </div>

      {/* Availability Banner */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
            const rule = rulesMap.get(dow);
            const isOpen = rule ? rule.isOpen : false;
            return (
              <div
                key={dow}
                className={cn(
                  "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium min-w-[80px]",
                  isOpen
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-50 text-gray-400 border border-gray-200"
                )}
              >
                <span className="font-bold">{HEBREW_DAY_NAMES[dow]}</span>
                <span className="mt-0.5">
                  {isOpen && rule
                    ? `${rule.openTime}-${rule.closeTime}`
                    : "סגור"}
                </span>
              </div>
            );
          })}
        </div>
        {selectedService && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {selectedService.name} — {selectedService.duration} דקות
              {selectedService.price > 0 && ` — ${formatCurrency(selectedService.price)}`}
            </span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Right Column (RTL) — Service + Calendar */}
        <div className="space-y-4">
          {/* Service Select */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              בחירת שירות
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => { if (activeServices.length > 0) setShowServiceDropdown((p) => !p); }}
                className={cn(
                  "input w-full text-start flex items-center justify-between gap-2",
                  activeServices.length === 0 && "opacity-60 cursor-not-allowed"
                )}
              >
                <span className={selectedService ? "text-gray-900 truncate" : "text-gray-400 truncate"}>
                  {selectedService
                    ? `${selectedService.name} — ${selectedService.duration} דק׳ — ${formatCurrency(selectedService.price)}`
                    : activeServices.length === 0
                      ? "אין שירותים פעילים — הוסף שירות בהגדרות או במחירון"
                      : "בחר שירות..."}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-gray-400 flex-shrink-0 transition-transform", showServiceDropdown && "rotate-180")} />
              </button>
              {showServiceDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowServiceDropdown(false)} />
                  <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                    {activeServices.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { handleServiceChange(s.id); setShowServiceDropdown(false); }}
                        className={cn(
                          "w-full text-start px-4 py-2.5 text-sm transition-colors",
                          selectedServiceId === s.id
                            ? "bg-orange-50 text-orange-700 font-medium"
                            : "text-gray-700 hover:bg-orange-50/50"
                        )}
                      >
                        {s.name} — {s.duration} דק׳ — {formatCurrency(s.price)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {activeServices.length === 0 && (services.length > 0 || priceListItems.length > 0) && (
              <p className="text-xs text-amber-600 mt-1">יש שירותים לא פעילים — הפעל אותם בהגדרות או במחירון</p>
            )}
          </div>

          {/* Month Calendar */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm font-bold text-gray-800">{monthLabel}</span>
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {HEBREW_DAYS_SHORT.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-gray-400 py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} className="h-9" />;
                }
                const ds = dateStr(calMonth.year, calMonth.month, day);
                const isToday = ds === today;
                const isSelected = ds === selectedDate;
                const isPast = isDayPast(day);
                const isClosed = isDayClosed(day);
                const disabled = isPast || isClosed;

                return (
                  <button
                    key={ds}
                    onClick={() => !disabled && handleDateSelect(day)}
                    disabled={disabled}
                    className={cn(
                      "h-9 rounded-lg text-sm font-medium transition-all",
                      disabled && "text-gray-300 cursor-not-allowed",
                      !disabled && !isSelected && "hover:bg-orange-50 text-gray-700",
                      isSelected && "bg-orange-500 text-white shadow-sm",
                      isToday && !isSelected && "ring-2 ring-orange-300",
                      isClosed && !isPast && "bg-gray-50"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Left Column (RTL) — Time Slots */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            בחירת שעה
          </h3>

          {!selectedServiceId && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              בחר שירות ותאריך כדי לראות תורים פנויים
            </div>
          )}

          {selectedServiceId && !selectedDate && (
            <div className="text-center py-10 text-gray-400 text-sm">
              <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              בחר תאריך מהלוח כדי לראות תורים פנויים
            </div>
          )}

          {selectedServiceId && selectedDate && slotsLoading && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 rounded-lg bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          )}

          {selectedServiceId &&
            selectedDate &&
            !slotsLoading &&
            filteredSlots.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>אין תורים זמינים ביום זה</p>
                <p className="text-xs mt-1">נסה לבחור יום אחר</p>
              </div>
            )}

          {selectedServiceId &&
            selectedDate &&
            !slotsLoading &&
            filteredSlots.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {filteredSlots.map((slot) => {
                  const isSelected = slot.time === selectedTime;
                  return (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={cn(
                        "h-11 rounded-lg text-sm font-medium transition-all border",
                        slot.available && !isSelected &&
                          "bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50",
                        !slot.available &&
                          "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed",
                        isSelected &&
                          "bg-orange-500 border-orange-500 text-white shadow-sm"
                      )}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Booking Form — full width */}
      {selectedTime && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-5 space-y-4 animate-slide-up">
          <h3 className="text-sm font-bold text-gray-700">פרטי התור</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                לקוח
              </label>
              {!showNewCustomer ? (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={
                        selectedCustomer
                          ? selectedCustomer.name
                          : customerSearch
                      }
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomerId("");
                        setSelectedPetId("");
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="חפש לקוח..."
                      className="input w-full pr-9"
                    />
                  </div>
                  {showCustomerDropdown && !selectedCustomerId && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredCustomers.slice(0, 20).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                            setSelectedPetId("");
                          }}
                          className="w-full text-right px-3 py-2 hover:bg-orange-50 flex items-center justify-between text-sm transition-colors"
                        >
                          <span className="text-gray-400 text-xs">{c.phone}</span>
                          <span className="font-medium text-gray-800">{c.name}</span>
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="px-3 py-3 text-center text-sm text-gray-400">
                          לא נמצאו לקוחות
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowNewCustomer(true);
                          setShowCustomerDropdown(false);
                          setSelectedCustomerId("");
                        }}
                        className="w-full text-right px-3 py-2.5 border-t border-gray-100 text-orange-600 hover:bg-orange-50 flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        צור לקוח חדש
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between mb-1">
                    <button
                      onClick={() => {
                        setShowNewCustomer(false);
                        setNewCustomerName("");
                        setNewCustomerPhone("");
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ← חזור לחיפוש
                    </button>
                    <span className="text-xs font-medium text-orange-700">
                      לקוח חדש
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="שם הלקוח *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="input w-full text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="טלפון *"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="input w-full text-sm"
                    dir="ltr"
                  />
                </div>
              )}
            </div>

            {/* Pet Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                חיית מחמד
              </label>
              {selectedCustomer && selectedCustomer.pets.length > 0 ? (
                <select
                  value={selectedPetId}
                  onChange={(e) => setSelectedPetId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">ללא בחירה</option>
                  {selectedCustomer.pets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.species === "dog" ? "כלב" : p.species === "cat" ? "חתול" : "אחר"})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="input w-full text-sm text-gray-400 flex items-center">
                  {selectedCustomerId
                    ? "אין חיות מחמד רשומות"
                    : "בחר לקוח קודם"}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              הערות
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות נוספות..."
              rows={2}
              className="input w-full resize-none"
            />
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-500">
              תאריך:{" "}
              <span className="font-medium text-gray-800">
                {formatHebDate(selectedDate)}
              </span>
            </span>
            <span className="text-gray-500">
              שעה: <span className="font-medium text-gray-800">{selectedTime}</span>
            </span>
            {selectedService && (
              <>
                <span className="text-gray-500">
                  שירות:{" "}
                  <span className="font-medium text-gray-800">
                    {selectedService.name}
                  </span>
                </span>
                <span className="text-gray-500">
                  משך:{" "}
                  <span className="font-medium text-gray-800">
                    {selectedService.duration} דקות
                  </span>
                </span>
                {selectedService.price > 0 && (
                  <span className="text-gray-500">
                    מחיר:{" "}
                    <span className="font-bold text-gray-900">
                      {formatCurrency(selectedService.price)}
                    </span>
                  </span>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {createAppointment.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {(createAppointment.error as Error).message || "שגיאה ביצירת התור"}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleBook}
            disabled={!isBookable || isSubmitting}
            className={cn(
              "btn-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
              (!isBookable || isSubmitting) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {isSubmitting ? "קובע תור..." : "קבע תור"}
          </button>
        </div>
      )}
    </div>
  );
}
