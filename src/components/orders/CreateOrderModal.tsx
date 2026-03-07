"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  X, Search, Plus, Minus, Trash2, CalendarDays, Clock,
  Send, MessageCircle, Building2, GraduationCap, Package, Scissors, Users,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { calcOrder, CalcLineInput } from "@/lib/order-calc";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceListItem {
  id: string;
  name: string;
  type: string;
  category: string | null;
  unit: string;
  basePrice: number;
  taxMode: string;
  durationMinutes: number | null;
  description: string | null;
  isActive: boolean;
  paymentUrl?: string | null;
  sessions?: number | null;
}

interface PriceList {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface OrderLineForm {
  priceListItemId: string | null;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxMode: "inherit" | "taxable" | "exempt";
  petIds: string[];
}

interface Business {
  vatEnabled: boolean;
  vatRate: number;
  boardingCalcMode: string;      // "nights" | "days"
  boardingMinNights: number;
  boardingCheckInTime: string;   // "HH:MM"
  boardingCheckOutTime: string;  // "HH:MM"
}

interface TrainingGroup {
  id: string;
  name: string;
  groupType: string;
  location: string | null;
  defaultDayOfWeek: number | null;
  defaultTime: string | null;
  isActive: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
}

interface CustomerDetail {
  pets?: Pet[];
}

const UNITS: { id: string; label: string }[] = [
  { id: "per_session", label: "לפגישה" },
  { id: "per_day", label: "ליום" },
  { id: "per_night", label: "ללילה" },
  { id: "per_hour", label: "לשעה" },
  { id: "per_item", label: "ליחידה" },
  { id: "fixed", label: "קבוע" },
];

function fmt(n: number) { return `₪${n.toFixed(2)}`; }
function unitLabel(unit: string) {
  return UNITS.find(u => u.id === unit)?.label ?? unit;
}
const PET_EMOJI: Record<string, string> = { dog: "🐕", cat: "🐈" };
function petEmoji(species: string) { return PET_EMOJI[species] ?? "🐾"; }

/** Returns today's date as YYYY-MM-DD */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns tomorrow's date as YYYY-MM-DD */
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate boarding units (nights or days) from check-in/out date+time.
 * - nights: Math.floor diff in days. If checkout time > business checkout cutoff → +1 night.
 * - days:   Math.ceil diff in days (partial day = full day).
 * Always respects minimum nights setting.
 */
function calcBoardingUnits(
  checkInDate: string,   // YYYY-MM-DD
  checkInTime: string,   // HH:MM
  checkOutDate: string,  // YYYY-MM-DD
  checkOutTime: string,  // HH:MM
  business: Business,
): number {
  if (!checkInDate || !checkOutDate) return business.boardingMinNights || 1;

  const checkIn = new Date(`${checkInDate}T${checkInTime || "12:00"}:00`);
  const checkOut = new Date(`${checkOutDate}T${checkOutTime || "12:00"}:00`);

  if (checkOut <= checkIn) return business.boardingMinNights || 1;

  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  let units: number;

  if (business.boardingCalcMode === "days") {
    units = Math.ceil(diffDays);
  } else {
    // nights mode
    units = Math.floor(diffDays);

    // If checkout time is after the business checkout cutoff → extra night
    const [cutoffH, cutoffM] = (business.boardingCheckOutTime || "12:00").split(":").map(Number);
    const [checkOutH, checkOutM] = (checkOutTime || "12:00").split(":").map(Number);
    const checkOutMinutes = checkOutH * 60 + checkOutM;
    const cutoffMinutes = cutoffH * 60 + cutoffM;

    if (checkOutMinutes > cutoffMinutes) {
      units += 1;
    }
  }

  const min = business.boardingMinNights || 1;
  return Math.max(units, min);
}

// ─── Category definitions ─────────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { id: "boarding",  label: "פנסיון",      icon: Building2,     color: "from-purple-500 to-purple-600" },
  { id: "training",  label: "אילוף",        icon: GraduationCap, color: "from-blue-500 to-blue-600" },
  { id: "products",  label: "מוצרים",      icon: Package,       color: "from-emerald-500 to-emerald-600" },
  { id: "grooming",  label: "טיפוח",       icon: Scissors,      color: "from-pink-500 to-pink-600" },
] as const;

// Map order type → Hebrew category label (must match category field in PriceListItem)
const CATEGORY_LABELS: Record<string, string> = {
  boarding: "פנסיון",
  training: "אילוף",
  grooming: "טיפוח",
  products: "מוצרים",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateOrderModal({
  isOpen,
  onClose,
  prefillCustomerId,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  prefillCustomerId?: string;
  onCreated?: (orderId: string) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();

  // Step state: "category" → "customer" → "items" → "review" → "payment"
  const [step, setStep] = useState<"category" | "customer" | "items" | "review" | "payment">("category");
  const [createdOrder, setCreatedOrder] = useState<{ id: string; status: string } | null>(null);

  // Customer
  const [customerId, setCustomerId] = useState(prefillCustomerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");

  // Order meta
  const [orderType, setOrderType] = useState("products");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("0");

  // Boarding pet selection
  const [boardingPetIds, setBoardingPetIds] = useState<string[]>([]);

  // General pet selection (for non-boarding orders)
  const [selectedPetId, setSelectedPetId] = useState<string>("");

  // Appointment fields (for training, grooming, service_dog)
  const [apptDate, setApptDate] = useState(todayStr());
  const [apptStartTime, setApptStartTime] = useState("09:00");
  const [apptEndTime, setApptEndTime] = useState("10:00");

  // Boarding specific date/time state
  const [boardingCheckInDate, setBoardingCheckInDate] = useState(todayStr());
  const [boardingCheckInTime, setBoardingCheckInTime] = useState("12:00");
  const [boardingCheckOutDate, setBoardingCheckOutDate] = useState(tomorrowStr());
  const [boardingCheckOutTime, setBoardingCheckOutTime] = useState("12:00");

  // WhatsApp link toggle
  const [includeLandingPage, setIncludeLandingPage] = useState(true);

  // Lines
  const [lines, setLines] = useState<OrderLineForm[]>([]);
  const [newLine, setNewLine] = useState<OrderLineForm>({
    priceListItemId: null, name: "", unit: "per_session", quantity: 1, unitPrice: 0, taxMode: "taxable", petIds: [],
  });

  // Training sub-type
  const [trainingSubType, setTrainingSubType] = useState<"private" | "package" | "boarding" | "group">("private");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [trainingProgramType, setTrainingProgramType] = useState<string>("BASIC_OBEDIENCE");
  // Boarding training extra fields
  const [trainingBoardingStart, setTrainingBoardingStart] = useState(todayStr());
  const [trainingBoardingEnd, setTrainingBoardingEnd] = useState("");
  const [trainingHomeFollowup, setTrainingHomeFollowup] = useState(0);
  // Group training
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Items step — "add service" sub-form
  const [addCat, setAddCat] = useState<string>("");
  const [addItemId, setAddItemId] = useState<string>("");
  const [addUnits, setAddUnits] = useState<number>(1);
  const [addCustomMode, setAddCustomMode] = useState(false);

  // Data
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-search", customerSearch],
    queryFn: () => fetch(`/api/customers${customerSearch ? `?search=${customerSearch}` : ""}`).then((r) => r.json()),
    enabled: isOpen && step === "customer",
    staleTime: 30_000,
  });

  const { data: priceLists = [] } = useQuery<PriceList[]>({
    queryKey: ["price-lists"],
    queryFn: () => fetch("/api/price-lists").then((r) => r.json()),
    enabled: isOpen,
  });
  const priceList = priceLists[0];

  // Fetch ALL active items across all price lists for this business
  const { data: allItems = [] } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items-all-active"],
    queryFn: () => fetch("/api/price-list-items").then((r) => r.json()),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: business } = useQuery<Business>({
    queryKey: ["business-settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 300_000,
  });

  // Training package items — price list items in "אילוף" category with sessions > 0
  const trainingPackages = allItems.filter(
    (i) => i.category === "אילוף" && i.sessions && i.sessions > 0 && i.isActive
  );

  const { data: trainingGroups = [] } = useQuery<TrainingGroup[]>({
    queryKey: ["training-groups-active"],
    queryFn: () => fetch("/api/training-groups").then((r) => r.json()),
    enabled: isOpen && orderType === "training",
    staleTime: 60_000,
  });

  // Fetch customer's pets — fast endpoint (only pets, not full customer detail)
  const { data: customerPets = [], isLoading: petsLoading } = useQuery<Pet[]>({
    queryKey: ["customer-pets", customerId],
    queryFn: () => fetch(`/api/customers/${customerId}/pets`).then((r) => r.json()),
    enabled: !!customerId && isOpen,
    staleTime: 60_000,
  });

  const toggleBoardingPet = (id: string) => {
    setBoardingPetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Auto-select the single pet when a customer with exactly 1 pet is loaded
  useEffect(() => {
    if (customerPets.length !== 1) return;
    if (isBoardingOrder) {
      setBoardingPetIds((prev) => (prev.length === 0 ? [customerPets[0].id] : prev));
    } else {
      setSelectedPetId((prev) => (prev === "" ? customerPets[0].id : prev));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPets]);

  // When business loads, seed boarding times from settings defaults
  useEffect(() => {
    if (business?.boardingCheckInTime) {
      setBoardingCheckInTime(business.boardingCheckInTime);
    }
    if (business?.boardingCheckOutTime) {
      setBoardingCheckOutTime(business.boardingCheckOutTime);
    }
  }, [business?.boardingCheckInTime, business?.boardingCheckOutTime]);

  const selectedCustomer = customers.find((c) => c.id === customerId) ??
    (prefillCustomerId ? { id: prefillCustomerId, name: "לקוח", phone: "" } : null);

  // ── Order type helpers ────────────────────────────────────────────────────

  const isBoardingOrder = orderType === "boarding";
  const needsAppointment = ["training", "grooming", "service_dog"].includes(orderType);

  // Whether any line is a boarding-type (per_night or per_day)
  const hasBoardingLine = lines.some((l) =>
    l.unit === "per_night" || l.unit === "per_day"
  );

  const boardingNights = useMemo(() => {
    if (!isBoardingOrder || !business) return null;
    return calcBoardingUnits(
      boardingCheckInDate,
      boardingCheckInTime,
      boardingCheckOutDate,
      boardingCheckOutTime,
      business,
    );
  }, [isBoardingOrder, business, boardingCheckInDate, boardingCheckInTime, boardingCheckOutDate, boardingCheckOutTime]);

  // Total boarding units = nights × number of pets selected
  const boardingUnits = useMemo(() => {
    if (boardingNights === null) return null;
    const petCount = Math.max(1, boardingPetIds.length);
    return boardingNights * petCount;
  }, [boardingNights, boardingPetIds.length]);

  // Auto-update qty of boarding lines when dates or pet count change
  useEffect(() => {
    if (!isBoardingOrder || boardingUnits === null) return;
    setLines((ls) =>
      ls.map((l) =>
        l.unit === "per_night" || l.unit === "per_day"
          ? { ...l, quantity: boardingUnits }
          : l
      )
    );
  }, [isBoardingOrder, boardingUnits]);

  // Build startAt

  // When advancing from customer step to items step in boarding mode — auto-add the primary boarding item
  const handleAdvanceToItems = useCallback(() => {
    if (isBoardingOrder && boardingUnits !== null && lines.length === 0) {
      const boardingItem = allItems.find(
        (i) => (i.unit === "per_night" || i.unit === "per_day") &&
                (i.category?.toLowerCase().includes("פנסיון") ?? true)
      );
      if (boardingItem) {
        setLines([{
          priceListItemId: boardingItem.id,
          name: boardingItem.name,
          unit: boardingItem.unit,
          quantity: boardingUnits,
          unitPrice: boardingItem.basePrice,
          taxMode: boardingItem.taxMode as "inherit" | "taxable" | "exempt",
          petIds: [...boardingPetIds],
        }]);
        // Skip items step for boarding when item is auto-added — go straight to review
        setStep("review");
        return;
      }
    }
    setStep("items");
  }, [isBoardingOrder, boardingUnits, lines.length, allItems, boardingPetIds]);

  // Build startAt / endAt from boarding fields when in boarding mode
  useEffect(() => {
    if (!isBoardingOrder) return;
    if (boardingCheckInDate) {
      setStartAt(`${boardingCheckInDate}T${boardingCheckInTime}:00`);
    }
    if (boardingCheckOutDate) {
      setEndAt(`${boardingCheckOutDate}T${boardingCheckOutTime}:00`);
    }
  }, [isBoardingOrder, boardingCheckInDate, boardingCheckInTime, boardingCheckOutDate, boardingCheckOutTime]);

  // Build startAt from appointment date/time when in service appointment mode
  useEffect(() => {
    if (!needsAppointment) return;
    if (apptDate && apptStartTime) {
      setStartAt(`${apptDate}T${apptStartTime}:00`);
    }
  }, [needsAppointment, apptDate, apptStartTime]);

  // Pre-select category chip when entering items step
  useEffect(() => {
    if (step === "items") {
      const label = CATEGORY_LABELS[orderType] ?? "";
      setAddCat(label);
      setAddItemId("");
      setAddCustomMode(false);
      setAddUnits(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Calc
  const calcInput: CalcLineInput[] = lines.map((l) => ({
    name: l.name, unit: l.unit, quantity: l.quantity,
    unitPrice: l.unitPrice, taxMode: l.taxMode,
  }));
  const calc = calcOrder({
    lines: calcInput,
    discountType,
    discountValue: parseFloat(discountValue) || 0,
    vatEnabled: business?.vatEnabled ?? true,
    vatRate: business?.vatRate ?? 0.17,
  });

  // Add price list item to lines
  const addItem = useCallback((item: PriceListItem) => {
    const existing = lines.findIndex((l) => l.priceListItemId === item.id);
    const isBoardingUnit = item.unit === "per_night" || item.unit === "per_day";
    const qty = (isBoardingOrder && isBoardingUnit && boardingUnits !== null)
      ? boardingUnits
      : 1;

    if (existing >= 0) {
      setLines((ls) => ls.map((l, i) => i === existing ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setLines((ls) => [...ls, {
        priceListItemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity: qty,
        unitPrice: item.basePrice,
        taxMode: item.taxMode as "inherit" | "taxable" | "exempt",
        petIds: [],
      }]);
    }
  }, [lines, isBoardingOrder, boardingUnits]);

  const updateQty = (idx: number, delta: number) => {
    setLines((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const q = Math.max(0.5, l.quantity + delta);
      return { ...l, quantity: q };
    }));
  };

  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  // Mutation — accepts explicit status to avoid stale-closure race condition
  const mutation = useMutation({
    mutationFn: async (statusOverride: "draft" | "confirmed") => {
      // 1. Create the order (+ linked Appointment for service types, via API transaction)
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          orderType,
          startAt: startAt || undefined,
          endAt: endAt || undefined,
          lines: lines.map(l => ({
            ...l,
            metadata: {
              petIds: l.petIds.length > 0 ? l.petIds : (selectedPetId ? [selectedPetId] : []),
            },
          })),
          petId: selectedPetId || undefined,
          discountType,
          discountValue: parseFloat(discountValue) || 0,
          notes,
          status: statusOverride,
          // Training: pass sub-type, package id, and program type for auto-program creation
          trainingSubType: orderType === "training" ? trainingSubType : undefined,
          programType: orderType === "training" ? trainingProgramType : undefined,
          trainingPackageId: orderType === "training" && trainingSubType === "package" && selectedPackageId ? selectedPackageId : undefined,
          trainingBoardingStart: orderType === "training" && trainingSubType === "boarding" ? trainingBoardingStart : undefined,
          trainingBoardingEnd: orderType === "training" && trainingSubType === "boarding" ? trainingBoardingEnd : undefined,
          trainingHomeFollowup: orderType === "training" && trainingSubType === "boarding" && trainingHomeFollowup > 0 ? trainingHomeFollowup : undefined,
          trainingGroupId: orderType === "training" && trainingSubType === "group" ? selectedGroupId : undefined,
          // Send appointment data for service-based order types
          appointmentData: needsAppointment ? {
            date: apptDate,
            startTime: apptStartTime,
            endTime: apptEndTime,
            petId: selectedPetId || undefined,
          } : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "שגיאה ביצירת ההזמנה" }));
        throw new Error(err.error || "שגיאה ביצירת ההזמנה");
      }

      const order = await res.json();

      // 2. If boarding order with pets selected → create a BoardingStay per pet
      if (isBoardingOrder && boardingPetIds.length > 0) {
        await Promise.all(
          boardingPetIds.map((petId) =>
            fetch("/api/boarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId,
                petId,
                roomId: null, // starts unassigned
                checkIn: `${boardingCheckInDate}T${boardingCheckInTime}:00`,
                checkOut: boardingCheckOutDate ? `${boardingCheckOutDate}T${boardingCheckOutTime}:00` : null,
                notes: notes || null,
              }),
            })
          )
        );
        qc.invalidateQueries({ queryKey: ["boarding"] });
      }

      // 3. Invalidate appointments so the calendar updates
      if (needsAppointment) {
        qc.invalidateQueries({ queryKey: ["appointments"] });
      }

      // 4. Invalidate training data when training order created
      if (orderType === "training") {
        qc.invalidateQueries({ queryKey: ["training-programs"] });
        qc.invalidateQueries({ queryKey: ["training-programs-boarding"] });
        if (trainingSubType === "group") {
          qc.invalidateQueries({ queryKey: ["training-groups"] });
          qc.invalidateQueries({ queryKey: ["training-groups-active"] });
        }
      }

      return order;
    },
    onSuccess: (data, statusOverride) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      onCreated?.(data.id);
      if (statusOverride === "confirmed") {
        setCreatedOrder(data);
        setStep("payment");
      } else {
        handleClose();
      }
    },
  });

  const handleClose = () => {
    setStep("category");
    setCustomerId(prefillCustomerId ?? "");
    setLines([]);
    setDiscountType("none");
    setDiscountValue("0");
    setNotes("");
    setOrderType("products");
    setStartAt(""); setEndAt("");
    setBoardingCheckInDate(todayStr());
    setBoardingCheckInTime(business?.boardingCheckInTime ?? "12:00");
    setBoardingCheckOutDate(tomorrowStr());
    setBoardingCheckOutTime(business?.boardingCheckOutTime ?? "12:00");
    setBoardingPetIds([]);
    setSelectedPetId("");
    setApptDate(todayStr());
    setApptStartTime("09:00");
    setApptEndTime("10:00");
    setTrainingSubType("private");
    setSelectedPackageId("");
    setTrainingProgramType("BASIC_OBEDIENCE");
    setTrainingBoardingStart(todayStr());
    setTrainingBoardingEnd("");
    setTrainingHomeFollowup(0);
    setSelectedGroupId("");
    setCreatedOrder(null);
    onClose();
  };

  if (!isOpen) return null;

  // ── Step 0: Category ──────────────────────────────────────────────────────
  const renderCategoryStep = () => (
    <div>
      <p className="text-sm text-petra-muted mb-4">בחר את סוג ההזמנה:</p>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORY_DEFS.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => { setOrderType(cat.id); setStep("customer"); }}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-100 hover:border-[#f38d49]/40 hover:shadow-md transition-all bg-white"
            >
              <div className={cn(
                "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform",
                cat.color
              )}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <span className="text-sm font-semibold text-petra-text">{cat.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <button onClick={handleClose} className="btn-secondary px-6">ביטול</button>
      </div>
    </div>
  );

  // ── Step 1: Customer ──────────────────────────────────────────────────────
  const renderCustomerStep = () => (
    <div className="space-y-4">
      {/* Service appointment: date + time + pet selector */}
      {needsAppointment && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-brand-600 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            פרטי התור ביומן
          </p>

          {/* Date */}
          <div>
            <label className="label text-xs text-petra-muted mb-1">תאריך</label>
            <input
              type="date"
              className="input text-sm"
              value={apptDate}
              onChange={(e) => setApptDate(e.target.value)}
            />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs text-petra-muted mb-1">שעת התחלה</label>
              <div className="relative">
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                <input
                  type="time"
                  className="input text-sm pr-9"
                  value={apptStartTime}
                  onChange={(e) => setApptStartTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label text-xs text-petra-muted mb-1">שעת סיום</label>
              <div className="relative">
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                <input
                  type="time"
                  className="input text-sm pr-9"
                  value={apptEndTime}
                  onChange={(e) => setApptEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Boarding: separate date + time fields with live calculation */}
      {orderType === "boarding" && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-brand-600 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            תאריכי שהייה
          </p>

          {/* Check-in row */}
          <div>
            <label className="label text-xs text-petra-muted mb-1">
              🔑 כניסה (Check-in)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="input text-sm"
                value={boardingCheckInDate}
                onChange={(e) => setBoardingCheckInDate(e.target.value)}
              />
              <div className="relative">
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                <input
                  type="time"
                  className="input text-sm pr-9"
                  value={boardingCheckInTime}
                  onChange={(e) => setBoardingCheckInTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Check-out row */}
          <div>
            <label className="label text-xs text-petra-muted mb-1">
              🚪 יציאה (Check-out)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="input text-sm"
                value={boardingCheckOutDate}
                onChange={(e) => setBoardingCheckOutDate(e.target.value)}
              />
              <div className="relative">
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted pointer-events-none" />
                <input
                  type="time"
                  className="input text-sm pr-9"
                  value={boardingCheckOutTime}
                  onChange={(e) => setBoardingCheckOutTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Live calculation badge */}
          {business && boardingNights !== null && boardingCheckInDate && boardingCheckOutDate && (
            <div className="flex items-center justify-between bg-white border border-brand-100 rounded-xl px-3 py-2">
              <span className="text-xs text-petra-muted">
                חישוב לפי הגדרות עסק
                {" · "}
                <span className="text-petra-text font-medium">
                  {business.boardingCalcMode === "days" ? "ימים" : "לילות"}
                </span>
              </span>
              <span className="text-sm font-bold text-brand-600">
                {boardingPetIds.length > 1
                  ? `${boardingNights} × ${boardingPetIds.length} כלבים = ${boardingUnits}`
                  : `${boardingNights}`
                }
                {" "}{business.boardingCalcMode === "days" ? "ימים" : "לילות"}
              </span>
            </div>
          )}

          {/* Notice if has boarding lines in cart */}
          {hasBoardingLine && (
            <p className="text-[11px] text-brand-500 flex items-center gap-1">
              ✓ הכמות בעגלה מתעדכנת אוטומטית לפי {boardingPetIds.length > 1 ? `לילות × ${boardingPetIds.length} כלבים` : "מספר הלילות"}
            </p>
          )}
        </div>
      )}

      {!prefillCustomerId && (
        <div>
          <label className="label">לקוח *</label>
          <div className="relative mb-2">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pr-10"
              placeholder="חיפוש לקוח..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto border border-petra-border rounded-xl divide-y divide-petra-border">
            {customers.slice(0, 20).map((c) => (
              <button
                key={c.id}
                onClick={() => setCustomerId(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-right",
                  customerId === c.id && "bg-brand-50"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
                  customerId === c.id ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-600"
                )}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium text-petra-text">{c.name}</p>
                  <p className="text-xs text-petra-muted" dir="ltr">{c.phone}</p>
                </div>
                {customerId === c.id && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
              </button>
            ))}
            {customers.length === 0 && (
              <div className="py-6 text-center text-sm text-petra-muted">לא נמצאו לקוחות</div>
            )}
          </div>
        </div>
      )}

      {prefillCustomerId && selectedCustomer && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-100 rounded-xl">
          <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold flex-shrink-0">
            {selectedCustomer.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-petra-text">{selectedCustomer.name}</p>
            <p className="text-xs text-petra-muted" dir="ltr">{selectedCustomer.phone}</p>
          </div>
        </div>
      )}

      {/* ── Pet selection — shown after customer is chosen ─────────────────── */}
      {customerId && (
        <>
          {/* Boarding: multi-dog checkboxes */}
          {isBoardingOrder && (
            <div>
              <label className="label flex items-center gap-1.5">
                🐾 כלבים לפנסיון
                {boardingPetIds.length > 0 && (
                  <span className="text-[11px] bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full font-bold">
                    {boardingPetIds.length} נבחרו
                  </span>
                )}
              </label>
              {petsLoading ? (
                <div className="text-sm text-petra-muted border border-dashed border-petra-border rounded-xl p-3 text-center animate-pulse">
                  טוען כלבים...
                </div>
              ) : customerPets.length === 0 ? (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-xl leading-none mt-0.5">🐾</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">לא ניתן ליצור הזמנה</p>
                    <p className="text-xs text-red-600 mt-0.5">חובה להוסיף חיית מחמד ללקוח לפני יצירת הזמנה.</p>
                    <a href={`/customers/${customerId}`} className="text-xs text-brand-600 underline mt-1 inline-block">הוסף חיית מחמד ← דף הלקוח</a>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {customerPets.map((p) => {
                    const selected = boardingPetIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleBoardingPet(p.id)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-right transition-all",
                          selected
                            ? "border-brand-400 bg-brand-50"
                            : "border-petra-border hover:bg-slate-50"
                        )}
                      >
                        <span className="text-lg leading-none flex-shrink-0">{petEmoji(p.species)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-petra-text">{p.name}</p>
                          {p.breed && <p className="text-xs text-petra-muted">{p.breed}</p>}
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          selected ? "border-brand-500 bg-brand-500" : "border-slate-300"
                        )}>
                          {selected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {boardingPetIds.length > 0 && (
                <p className="text-[11px] text-brand-500 mt-1.5 flex items-center gap-1">
                  ✓ {boardingPetIds.length === 1 ? "הכלב" : `${boardingPetIds.length} הכלבים`} יופיע{boardingPetIds.length > 1 ? "ו" : ""} אוטומטית בלוח הפנסיון תחת &quot;ממתין לשיבוץ&quot;
                </p>
              )}
            </div>
          )}

          {/* Non-boarding: pet selection */}
          {!isBoardingOrder && petsLoading && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs text-amber-600 text-center animate-pulse">
              טוען כלבים...
            </div>
          )}
          {!isBoardingOrder && !petsLoading && customerPets.length === 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <span className="text-xl leading-none mt-0.5">🐾</span>
              <div>
                <p className="text-sm font-semibold text-red-700">לא ניתן ליצור הזמנה</p>
                <p className="text-xs text-red-600 mt-0.5">חובה להוסיף חיית מחמד ללקוח לפני יצירת הזמנה.</p>
                <a href={`/customers/${customerId}`} className="text-xs text-brand-600 underline mt-1 inline-block">הוסף חיית מחמד ← דף הלקוח</a>
              </div>
            </div>
          )}
          {!isBoardingOrder && !petsLoading && customerPets.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                🐾 עבור איזה כלב?
              </p>
              <div className="flex flex-wrap gap-2">
                {customerPets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPetId("")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      selectedPetId === ""
                        ? "border-amber-400 bg-amber-100 text-amber-800"
                        : "border-petra-border bg-white text-petra-muted hover:bg-slate-50"
                    )}
                  >
                    כל הכלבים
                  </button>
                )}
                {customerPets.map((pet) => (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => setSelectedPetId(pet.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      selectedPetId === pet.id
                        ? "border-amber-400 bg-amber-100 text-amber-800"
                        : "border-petra-border bg-white text-petra-muted hover:bg-slate-50"
                    )}
                  >
                    <span>{petEmoji(pet.species)}</span>
                    <span>{pet.name}</span>
                    {pet.breed && <span className="opacity-60">({pet.breed})</span>}
                  </button>
                ))}
              </div>
              {selectedPetId && (
                <p className="text-[11px] text-amber-600">
                  ✓ ההזמנה תשויך ל{customerPets.find(p => p.id === selectedPetId)?.name}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Training order: warn if no pet selected */}
      {orderType === "training" && !petsLoading && customerPets.length > 0 && !selectedPetId && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
          יש לבחור כלב ספציפי לפני המשך — ההזמנה תקשר לתוכנית אילוף
        </p>
      )}
      <button
        type="button"
        className="btn-primary w-full"
        disabled={
          !customerId ||
          (!petsLoading && customerPets.length === 0) ||
          (orderType === "training" && !petsLoading && customerPets.length > 0 && !selectedPetId)
        }
        onClick={handleAdvanceToItems}
      >
        המשך לפריטים →
      </button>
    </div>
  );

  // ── Step 2: Items ─────────────────────────────────────────────────────────
  const renderItemsStep = () => {
    const CHIP_CATS = ["פנסיון", "אילוף", "טיפוח", "מוצרים"];
    const catItems = allItems.filter(i => (i.category ?? "").toLowerCase() === addCat.toLowerCase());
    const selectedAddItem = catItems.find(i => i.id === addItemId);

    const handleAddToCart = () => {
      if (!selectedAddItem) return;
      const isBoardingUnit = selectedAddItem.unit === "per_night" || selectedAddItem.unit === "per_day";
      const qty = (isBoardingOrder && isBoardingUnit && boardingUnits !== null) ? boardingUnits : addUnits;
      const existing = lines.findIndex(l => l.priceListItemId === selectedAddItem.id);
      if (existing >= 0) {
        setLines(ls => ls.map((l, i) => i === existing ? { ...l, quantity: l.quantity + qty } : l));
      } else {
        setLines(ls => [...ls, {
          priceListItemId: selectedAddItem.id,
          name: selectedAddItem.name,
          unit: selectedAddItem.unit,
          quantity: qty,
          unitPrice: selectedAddItem.basePrice,
          taxMode: selectedAddItem.taxMode as "inherit" | "taxable" | "exempt",
          petIds: [],
        }]);
      }
      setAddItemId("");
      setAddUnits(1);
    };

    return (
      <div className="space-y-4">

        {/* Training sub-type selector */}
        {orderType === "training" && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-3">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              סוג האילוף
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "private" as const, label: "מפגש בודד", sub: "ללא חבילה" },
                { id: "package" as const, label: "חבילת אילוף", sub: "עם כמות מוגדרת" },
                { id: "boarding" as const, label: "אילוף פנסיון", sub: "שהייה בכלבייה" },
                { id: "group" as const, label: "אילוף קבוצתי", sub: "בחר קבוצה" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setTrainingSubType(opt.id); setSelectedPackageId(""); setSelectedGroupId(""); }}
                  className={cn(
                    "p-3 rounded-xl border text-right transition-all",
                    trainingSubType === opt.id
                      ? "border-blue-400 bg-blue-100"
                      : "border-petra-border bg-white hover:bg-slate-50"
                  )}
                >
                  <p className={cn("text-sm font-semibold", trainingSubType === opt.id ? "text-blue-700" : "text-petra-text")}>{opt.label}</p>
                  <p className="text-[11px] text-petra-muted">{opt.sub}</p>
                </button>
              ))}
            </div>

            {/* Package sub-form */}
            {trainingSubType === "package" && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-petra-muted">בחר חבילה</p>
                {trainingPackages.length === 0 ? (
                  <p className="text-xs text-petra-muted">אין חבילות פעילות. הגדר חבילות תחת אילוף → חבילת אילוף.</p>
                ) : (
                  <div className="space-y-1.5">
                    {trainingPackages.map((pkg) => {
                      const selected = selectedPackageId === pkg.id;
                      const pkgSessions = pkg.sessions ?? 0;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => {
                            setSelectedPackageId(pkg.id);
                            setLines([{
                              priceListItemId: pkg.id,
                              name: pkg.name,
                              unit: pkg.unit,
                              quantity: 1,
                              unitPrice: pkg.basePrice,
                              taxMode: pkg.taxMode as "inherit" | "taxable" | "exempt",
                              petIds: [],
                            }]);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-right transition-all",
                            selected ? "border-blue-400 bg-blue-50" : "border-petra-border bg-white hover:bg-slate-50"
                          )}
                        >
                          <Package className={cn("w-4 h-4 flex-shrink-0", selected ? "text-blue-600" : "text-petra-muted")} />
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-semibold", selected ? "text-blue-700" : "text-petra-text")}>{pkg.name}</p>
                            <p className="text-xs text-petra-muted">{pkgSessions} מפגשים{pkg.description ? ` · ${pkg.description}` : ""}</p>
                          </div>
                          <span className={cn("text-sm font-bold flex-shrink-0", selected ? "text-blue-600" : "text-petra-text")}>
                            ₪{pkg.basePrice.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Boarding training sub-form */}
            {trainingSubType === "boarding" && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-petra-muted block mb-1">כניסה לפנסיון</label>
                    <input type="date" className="input text-sm" value={trainingBoardingStart} onChange={(e) => setTrainingBoardingStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-petra-muted block mb-1">יציאה מהפנסיון</label>
                    <input type="date" className="input text-sm" value={trainingBoardingEnd} onChange={(e) => setTrainingBoardingEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-petra-muted block mb-1">מפגשי המשך בבית הלקוח (לאחר הפנסיון)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="input w-20 text-center text-sm"
                      value={trainingHomeFollowup || ""}
                      placeholder="0"
                      onChange={(e) => setTrainingHomeFollowup(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                    <span className="text-xs text-petra-muted">מפגשים (0 = ללא)</span>
                  </div>
                  {trainingHomeFollowup > 0 && (
                    <p className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg mt-1">
                      ✓ תוכנית המשך של {trainingHomeFollowup} מפגשים תיווצר אוטומטית
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Group training sub-form */}
            {trainingSubType === "group" && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-petra-muted">בחר קבוצת אילוף</p>
                {trainingGroups.filter(g => g.isActive).length === 0 ? (
                  <p className="text-xs text-petra-muted">אין קבוצות פעילות. הגדר קבוצות תחת לשונית אילוף.</p>
                ) : (
                  <div className="space-y-1.5">
                    {trainingGroups.filter(g => g.isActive).map((grp) => {
                      const selected = selectedGroupId === grp.id;
                      const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
                      const dayLabel = grp.defaultDayOfWeek != null ? `יום ${DAY_NAMES[grp.defaultDayOfWeek]}` : "";
                      const timeLabel = grp.defaultTime ?? "";
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => setSelectedGroupId(selected ? "" : grp.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-right transition-all",
                            selected ? "border-blue-400 bg-blue-50" : "border-petra-border bg-white hover:bg-slate-50"
                          )}
                        >
                          <Users className={cn("w-4 h-4 flex-shrink-0", selected ? "text-blue-600" : "text-petra-muted")} />
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-semibold", selected ? "text-blue-700" : "text-petra-text")}>{grp.name}</p>
                            <p className="text-xs text-petra-muted">
                              {[dayLabel, timeLabel, grp.location].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Training program type selector */}
        {orderType === "training" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center gap-3">
            <span className="text-xs font-semibold text-petra-muted flex-shrink-0">סוג תוכנית:</span>
            <select
              className="input text-xs flex-1 py-1"
              value={trainingProgramType}
              onChange={(e) => setTrainingProgramType(e.target.value)}
            >
              <option value="BASIC_OBEDIENCE">משמעת בסיסית</option>
              <option value="REACTIVITY">תגובתיות</option>
              <option value="PUPPY">גורים</option>
              <option value="BEHAVIOR">בעיות התנהגות</option>
              <option value="ADVANCED">מתקדם</option>
              <option value="CUSTOM">מותאם אישית</option>
            </select>
          </div>
        )}

        {/* Boarding dates reminder */}
        {isBoardingOrder && boardingNights !== null && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-xl text-xs text-brand-600">
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {boardingCheckInDate} → {boardingCheckOutDate}
              {" · "}
              <strong>
                {boardingPetIds.length > 1
                  ? `${boardingNights} × ${boardingPetIds.length} כלבים = ${boardingUnits} ${business?.boardingCalcMode === "days" ? "ימים" : "לילות"}`
                  : `${boardingNights} ${business?.boardingCalcMode === "days" ? "ימים" : "לילות"}`
                }
              </strong>
            </span>
          </div>
        )}

        {/* Category chips */}
        <div>
          <p className="text-xs font-semibold text-petra-muted mb-2">בחר קטגוריה</p>
          <div className="flex flex-wrap gap-2">
            {CHIP_CATS.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => { setAddCat(cat); setAddItemId(""); setAddUnits(1); setAddCustomMode(false); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2",
                  addCat === cat && !addCustomMode
                    ? "bg-[#1a3a5c] text-white border-[#1a3a5c]"
                    : "bg-white text-petra-text border-petra-border hover:border-[#1a3a5c]/40"
                )}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setAddCustomMode(true); setAddCat(""); setAddItemId(""); }}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition-all border-2",
                addCustomMode
                  ? "bg-[#1a3a5c] text-white border-[#1a3a5c]"
                  : "bg-white text-petra-text border-petra-border hover:border-[#1a3a5c]/40"
              )}
            >
              שירות ידני
            </button>
          </div>
        </div>

        {/* Service picker — shown when a category chip is active */}
        {addCat && !addCustomMode && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-petra-border">
            <div>
              <p className="text-sm font-semibold text-petra-text mb-1.5">שירות נבחר</p>
              {catItems.length === 0 ? (
                <div className="text-sm text-petra-muted p-3 bg-white border border-dashed border-petra-border rounded-xl text-center">
                  אין שירותים בקטגוריה &quot;{addCat}&quot;.{" "}
                  <a href="/pricing" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">הוסף במחירון</a>
                </div>
              ) : (
                <select
                  className="input text-sm bg-white"
                  value={addItemId}
                  onChange={(e) => {
                    setAddItemId(e.target.value);
                    const item = catItems.find(i => i.id === e.target.value);
                    if (item) {
                      const isBoardingUnit = item.unit === "per_night" || item.unit === "per_day";
                      setAddUnits((isBoardingOrder && isBoardingUnit && boardingUnits !== null) ? boardingUnits : 1);
                    }
                  }}
                >
                  <option value="">בחר שירות...</option>
                  {catItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} — ₪{i.basePrice}</option>
                  ))}
                </select>
              )}
            </div>

            {addItemId && selectedAddItem && (
              <>
                <div>
                  <p className="text-sm font-semibold text-petra-text mb-1.5">סה&quot;כ יחידות</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setAddUnits(u => Math.max(0.5, u - 1))}
                      className="w-9 h-9 rounded-xl border border-petra-border flex items-center justify-center hover:bg-slate-100 transition-all">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number" min="0.5" step="0.5" dir="ltr"
                      className="input text-sm text-center flex-1"
                      value={addUnits}
                      onChange={(e) => setAddUnits(parseFloat(e.target.value) || 1)}
                    />
                    <button type="button" onClick={() => setAddUnits(u => u + 1)}
                      className="w-9 h-9 rounded-xl border border-petra-border flex items-center justify-center hover:bg-slate-100 transition-all">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold text-petra-text flex-shrink-0 min-w-[60px] text-left">
                      = {fmt(addUnits * selectedAddItem.basePrice)}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={handleAddToCart} className="btn-primary w-full">
                  <Plus className="w-4 h-4" /> הוסף לעגלה
                </button>
              </>
            )}
          </div>
        )}

        {/* Custom / manual service form */}
        {addCustomMode && (
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-petra-border">
            <p className="text-sm font-semibold text-petra-text">שירות ידני</p>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="שם שירות *" value={newLine.name}
                onChange={(e) => setNewLine({ ...newLine, name: e.target.value })} />
              <select className="input text-sm" value={newLine.unit}
                onChange={(e) => setNewLine({ ...newLine, unit: e.target.value })}>
                {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" dir="ltr" className="input text-sm" placeholder="מחיר ₪"
                value={newLine.unitPrice || ""}
                onChange={(e) => setNewLine({ ...newLine, unitPrice: parseFloat(e.target.value) || 0 })} />
              <input type="number" min="0.5" step="0.5" dir="ltr" className="input text-sm" placeholder="כמות"
                value={newLine.quantity}
                onChange={(e) => setNewLine({ ...newLine, quantity: parseFloat(e.target.value) || 1 })} />
            </div>
            <button
              onClick={() => {
                if (!newLine.name) return;
                setLines([...lines, { ...newLine }]);
                setNewLine({ priceListItemId: null, name: "", unit: "per_session", quantity: 1, unitPrice: 0, taxMode: "taxable", petIds: [] });
                setAddCustomMode(false);
              }}
              className="btn-primary w-full"
              disabled={!newLine.name}
            >
              הוסף לעגלה
            </button>
          </div>
        )}


        {/* Cart items summary */}
        {lines.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-petra-muted">פריטים בעגלה ({lines.length})</p>
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-petra-border rounded-xl text-sm">
                <button
                  type="button"
                  onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                  className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="font-medium text-petra-text flex-1">{line.name}</span>
                <span className="text-petra-muted text-xs">×{line.quantity}</span>
                <span className="font-semibold text-petra-text flex-shrink-0">{fmt(line.quantity * line.unitPrice)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Discount */}
        {lines.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <select className="input text-sm" value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "none" | "percent" | "fixed")}>
              <option value="none">ללא הנחה</option>
              <option value="percent">הנחה %</option>
              <option value="fixed">הנחה ₪</option>
            </select>
            {discountType !== "none" && (
              <input type="number" min="0" step="0.01" dir="ltr" className="input text-sm"
                placeholder={discountType === "percent" ? "% הנחה" : "₪ הנחה"}
                value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            )}
          </div>
        )}

        <button
          type="button"
          className="btn-primary w-full"
          disabled={lines.length === 0}
          onClick={() => setStep("review")}
        >
          המשך לסיכום ({fmt(calc.total)}) →
        </button>
      </div>
    );
  };

  // ── WhatsApp message builder ─────────────────────────────────────────────
  const buildWhatsAppMessage = () => {
    const name = selectedCustomer?.name ?? "לקוח";
    const lineItems = calc.lines
      .map((l) => `• ${l.name} x${l.quantity} - ${fmt(l.lineSubtotal)}`)
      .join("\n");
    const discountLine = calc.discountAmount > 0
      ? `\nהנחה: -${fmt(calc.discountAmount)}`
      : "";
    const taxLine = calc.taxTotal > 0
      ? `\nמע"מ: ${fmt(calc.taxTotal)}`
      : "";

    let paymentLinks = "";
    if (includeLandingPage) {
      const itemLinks = lines
        .map(l => {
          const item = allItems.find(i => i.id === l.priceListItemId);
          return item?.paymentUrl;
        })
        .filter(Boolean);

      if (itemLinks.length > 0) {
        paymentLinks = `\n\nלמעבר לתשלום ופרטים נוספים:\n${Array.from(new Set(itemLinks)).join("\n")}`;
      }
    }

    return `שלום ${name},\nהנה פירוט ההזמנה שלך:\n${lineItems}${discountLine}${taxLine}\n\nסה"כ לתשלום: ${fmt(calc.total)}${paymentLinks}`;
  };

  const openWhatsApp = (phone: string) => {
    const msg = encodeURIComponent(buildWhatsAppMessage());
    const waPhone = toWhatsAppPhone(phone);
    window.open(`https://wa.me/${waPhone}?text=${msg}`, "_blank");
  };

  // ── Step 4: Payment ────────────────────────────────────────────────────────
  const renderPaymentStep = () => (
    <div className="space-y-4">
      {/* Success + WhatsApp banner */}
      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-700">ההזמנה אושרה בהצלחה!</p>
          <p className="text-xs text-emerald-600">שלח ללקוח בקשת תשלום בוואטסאפ</p>
        </div>
      </div>

      {/* Order summary card */}
      <div className="bg-slate-50 rounded-2xl border border-petra-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-petra-border bg-white">
          <p className="text-sm font-semibold text-petra-text">{selectedCustomer?.name}</p>
        </div>
        {calc.lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2.5 border-b border-petra-border last:border-0">
            <span className="flex-1 text-sm text-petra-text">{l.name}</span>
            <span className="text-xs text-petra-muted flex-shrink-0">{l.quantity} × {fmt(l.unitPrice)}</span>
            <span className="text-sm font-semibold text-petra-text flex-shrink-0 w-16 text-left">{fmt(l.lineSubtotal)}</span>
          </div>
        ))}
      </div>

      {/* Landing page toggle */}
      {lines.some(l => allItems.find(i => i.id === l.priceListItemId)?.paymentUrl) && (
        <label className="flex items-center gap-2 text-sm text-petra-text cursor-pointer my-2 bg-slate-50 p-2 rounded-xl border border-petra-border transition-colors hover:bg-slate-100">
          <input
            type="checkbox"
            checked={includeLandingPage}
            onChange={(e) => setIncludeLandingPage(e.target.checked)}
            className="rounded border-petra-border text-brand-500 focus:ring-brand-500 w-4 h-4"
          />
          כלול קישור לדף נחיתה / תשלום בהודעה הקרובה
        </label>
      )}

      {/* Totals */}
      <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 border border-petra-border">
        {calc.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>הנחה</span>
            <span dir="ltr">−{fmt(calc.discountAmount)}</span>
          </div>
        )}
        {calc.taxTotal > 0 && (
          <div className="flex justify-between text-sm text-petra-muted">
            <span>מע&quot;מ</span>
            <span dir="ltr">{fmt(calc.taxTotal)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-petra-text border-t border-petra-border pt-1.5 mt-1.5">
          <span>סה&quot;כ לתשלום</span>
          <span dir="ltr">{fmt(calc.total)}</span>
        </div>
      </div>

      {/* For training orders: shortcut to open a training program */}
      {orderType === "training" && (
        <button
          className="btn-secondary w-full text-sm"
          onClick={() => {
            router.push(`/training?customerId=${customerId}${selectedPetId ? `&petId=${selectedPetId}` : ""}`);
            handleClose();
          }}
        >
          פתח תוכנית אילוף →
        </button>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          className="flex-1 py-2.5 rounded-xl border-2 border-petra-border text-sm font-medium text-petra-text hover:bg-slate-50 transition-all"
          onClick={() => {
            if (createdOrder?.id) {
              router.push(`/orders/${createdOrder.id}`);
            }
            handleClose();
          }}
        >
          מעבר להזמנה בקופה
        </button>
        <button
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
          style={{ background: "#25D366" }}
          onClick={() => {
            if (selectedCustomer?.phone) openWhatsApp(selectedCustomer.phone);
            if (createdOrder?.id) {
              router.push(`/orders/${createdOrder.id}`);
            }
            handleClose();
          }}
          disabled={!selectedCustomer?.phone}
        >
          <Send className="w-4 h-4" />
          שלח הודעה ומעבר
        </button>
      </div>
    </div>
  );

  // ── Step 3: Review ────────────────────────────────────────────────────────
  const renderReviewStep = () => (
    <div className="space-y-4">
      {/* Boarding stay summary */}
      {isBoardingOrder && boardingUnits !== null && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-100 rounded-xl">
          <div className="text-2xl">🏠</div>
          <div className="flex-1 text-right">
            <p className="text-xs text-petra-muted">כניסה</p>
            <p className="text-sm font-semibold text-petra-text">{boardingCheckInDate} בשעה {boardingCheckInTime}</p>
          </div>
          <div className="flex flex-col items-center px-2">
            <div className="text-xs font-bold text-brand-600">{boardingUnits}</div>
            <div className="text-[10px] text-petra-muted">{business?.boardingCalcMode === "days" ? "ימים" : "לילות"}</div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-petra-muted">יציאה</p>
            <p className="text-sm font-semibold text-petra-text">{boardingCheckOutDate} בשעה {boardingCheckOutTime}</p>
          </div>
        </div>
      )}

      {/* Order summary */}
      <div className="bg-slate-50 rounded-2xl border border-petra-border overflow-hidden">
        {calc.lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-2.5 border-b border-petra-border last:border-0">
            <span className="flex-1 text-sm text-petra-text">{l.name}</span>
            <span className="text-xs text-petra-muted flex-shrink-0">{l.quantity} × {fmt(l.unitPrice)}</span>
            <span className="text-sm font-semibold text-petra-text flex-shrink-0 w-16 text-left">{fmt(l.lineSubtotal)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 border border-petra-border">
        <div className="flex justify-between text-sm text-petra-muted">
          <span>סכום ביניים</span>
          <span dir="ltr">{fmt(calc.subtotal)}</span>
        </div>
        {calc.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-emerald-600">
            <span>הנחה ({discountType === "percent" ? `${discountValue}%` : "קבועה"})</span>
            <span dir="ltr">−{fmt(calc.discountAmount)}</span>
          </div>
        )}
        {calc.taxTotal > 0 && (
          <div className="flex justify-between text-sm text-petra-muted">
            <span>כולל מע&quot;מ ({((business?.vatRate ?? 0.17) * 100).toFixed(0)}%)</span>
            <span dir="ltr">{fmt(calc.taxTotal)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-petra-text border-t border-petra-border pt-1.5 mt-1.5">
          <span>סה&quot;כ לתשלום</span>
          <span dir="ltr">{fmt(calc.total)}</span>
        </div>
      </div>

      <div>
        <label className="label">הערות להזמנה</label>
        <textarea
          className="input resize-none text-sm"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות, הוראות מיוחדות..."
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {mutation.error?.message || "שגיאה ביצירת ההזמנה"}
        </p>
      )}

      {/* ── Payment request button ── */}
      {selectedCustomer?.phone && (
        <button
          type="button"
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
          style={{ background: "#25D366" }}
          onClick={() => openWhatsApp(selectedCustomer.phone)}
        >
          <Send className="w-4 h-4" />
          שלח דרישת תשלום ללקוח (WhatsApp)
        </button>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 py-2.5 rounded-xl border-2 border-petra-border text-sm font-medium text-petra-text hover:bg-slate-50 transition-all"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("draft")}
        >
          שמור כטיוטה
        </button>
        <button
          className="btn-primary flex-1"
          disabled={mutation.isPending || calc.total <= 0}
          onClick={() => mutation.mutate("confirmed")}
        >
          {mutation.isPending ? "שומר..." : `אשר הזמנה ${fmt(calc.total)}`}
        </button>
      </div>
    </div>
  );

  // Step phase for the 3-dot indicator (matching the screenshot design)
  const stepPhase = step === "category" ? 1 : (step === "customer" || step === "items") ? 2 : 3;
  const stepLabel = step === "category" ? "בחירת קטגוריה"
    : step === "customer" ? "לקוח"
    : step === "items" ? "פריטים"
    : step === "review" ? "סיכום"
    : "תשלום";

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-content max-w-lg mx-4 p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-petra-text">
              {step === "category"
                ? "הזמנה חדשה"
                : `הזמנת ${CATEGORY_LABELS[orderType] ?? "שירות"}`}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    s === stepPhase
                      ? "w-8 bg-gradient-to-l from-[#f38d49] to-[#FB923C]"
                      : s < stepPhase
                        ? "w-6 bg-[#f38d49]/40"
                        : "w-6 bg-slate-200"
                  )}
                />
              ))}
              <span className="text-xs text-petra-muted mr-1">{stepLabel}</span>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Back button (not on category or payment) */}
        {step !== "category" && step !== "payment" && (
          <div className="px-6 pt-3 flex-shrink-0">
            <button
              onClick={() => {
                if (step === "customer") setStep("category");
                else if (step === "items") setStep("customer");
                else if (step === "review") setStep("items");
              }}
              className="text-xs text-petra-muted hover:text-petra-text flex items-center gap-1"
            >
              ← חזרה
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === "category" && renderCategoryStep()}
          {step === "customer" && renderCustomerStep()}
          {step === "items" && renderItemsStep()}
          {step === "review" && renderReviewStep()}
          {step === "payment" && renderPaymentStep()}
        </div>
      </div>
    </div>
  );
}
