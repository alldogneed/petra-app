"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  X, Search, Plus, Minus, Trash2, ShoppingCart, CalendarDays, Clock,
  Send, MessageCircle, CheckCircle2,
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
  isActive: boolean;
  paymentUrl?: string | null;
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

  // Step state: "customer" | "items" | "review" | "payment"
  const [step, setStep] = useState<"customer" | "items" | "review" | "payment">("customer");
  const [createdOrder, setCreatedOrder] = useState<{ id: string; status: string } | null>(null);

  // Customer
  const [customerId, setCustomerId] = useState(prefillCustomerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");

  // Order meta
  const [orderType, setOrderType] = useState("sale");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("0");

  // Boarding pet selection
  const [boardingPetIds, setBoardingPetIds] = useState<string[]>([]);

  // Boarding specific date/time state
  const [boardingCheckInDate, setBoardingCheckInDate] = useState(todayStr());
  const [boardingCheckInTime, setBoardingCheckInTime] = useState("12:00");
  const [boardingCheckOutDate, setBoardingCheckOutDate] = useState(tomorrowStr());
  const [boardingCheckOutTime, setBoardingCheckOutTime] = useState("12:00");

  // WhatsApp link toggle
  const [includeLandingPage, setIncludeLandingPage] = useState(true);

  // Lines
  const [lines, setLines] = useState<OrderLineForm[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [customLine, setCustomLine] = useState(false);
  const [newLine, setNewLine] = useState<OrderLineForm>({
    priceListItemId: null, name: "", unit: "per_session", quantity: 1, unitPrice: 0, taxMode: "taxable", petIds: [],
  });

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

  const { data: allItems = [] } = useQuery<PriceListItem[]>({
    queryKey: ["price-list-items-active", priceList?.id],
    queryFn: () => fetch(`/api/price-lists/${priceList!.id}/items?active=true`).then((r) => r.json()),
    enabled: !!priceList?.id && isOpen,
    staleTime: 60_000,
  });

  const { data: business } = useQuery<Business>({
    queryKey: ["business-settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 300_000,
  });

  // Fetch customer's pets when boarding order and customer selected
  const { data: customerDetail } = useQuery<CustomerDetail>({
    queryKey: ["customer-pets", customerId],
    queryFn: () => fetch(`/api/customers/${customerId}`).then((r) => r.json()),
    enabled: !!customerId && isOpen,
    staleTime: 60_000,
  });
  const customerPets: Pet[] = customerDetail?.pets ?? [];

  const toggleBoardingPet = (id: string) => {
    setBoardingPetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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

  // Filtered items
  const filteredItems = useMemo(
    () => allItems.filter((i) =>
      !itemSearch ||
      i.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      (i.category ?? "").toLowerCase().includes(itemSearch.toLowerCase())
    ),
    [allItems, itemSearch]
  );

  // ── Boarding unit calculation ─────────────────────────────────────────────

  const isBoardingOrder = orderType === "boarding";

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
      // 1. Create the order
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          orderType,
          startAt: startAt || undefined,
          endAt: endAt || undefined,
          lines: lines.map(l => ({ ...l, metadata: { petIds: l.petIds } })),
          discountType,
          discountValue: parseFloat(discountValue) || 0,
          notes,
          status: statusOverride,
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
                checkIn: boardingCheckInDate,
                checkOut: boardingCheckOutDate || null,
                notes: notes || null,
              }),
            })
          )
        );
        qc.invalidateQueries({ queryKey: ["boarding"] });
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
    setStep("customer");
    setCustomerId(prefillCustomerId ?? "");
    setLines([]);
    setDiscountType("none");
    setDiscountValue("0");
    setNotes("");
    setOrderType("sale");
    setStartAt(""); setEndAt("");
    setBoardingCheckInDate(todayStr());
    setBoardingCheckInTime(business?.boardingCheckInTime ?? "12:00");
    setBoardingCheckOutDate(tomorrowStr());
    setBoardingCheckOutTime(business?.boardingCheckOutTime ?? "12:00");
    setBoardingPetIds([]);
    setCreatedOrder(null);
    onClose();
  };

  if (!isOpen) return null;

  // ── Step 1: Customer ──────────────────────────────────────────────────────
  const renderCustomerStep = () => (
    <div className="space-y-4">
      <div>
        <label className="label">סוג הזמנה</label>
        <div className="flex gap-2">
          {[
            { id: "sale", label: "🛒 מכירה" },
            { id: "appointment", label: "📅 תור" },
            { id: "boarding", label: "🏠 פנסיון" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setOrderType(t.id)}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                orderType === t.id
                  ? "border-brand-400 bg-brand-50 text-brand-600"
                  : "border-petra-border text-petra-muted hover:bg-slate-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointment: single datetime-local block */}
      {orderType === "appointment" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">מתאריך</label>
            <input type="datetime-local" className="input text-sm" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label className="label">עד תאריך</label>
            <input type="datetime-local" className="input text-sm" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
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

      {/* Boarding: pet selection (shown after customer is chosen) */}
      {isBoardingOrder && customerId && (
        <div>
          <label className="label flex items-center gap-1.5">
            🐾 כלבים לפנסיון
            {boardingPetIds.length > 0 && (
              <span className="text-[11px] bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full font-bold">
                {boardingPetIds.length} נבחרו
              </span>
            )}
          </label>
          {customerPets.length === 0 ? (
            <div className="text-sm text-petra-muted border border-dashed border-petra-border rounded-xl p-3 text-center">
              אין חיות מחמד ללקוח זה
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

      <button
        className="btn-primary w-full"
        disabled={!customerId}
        onClick={() => setStep("items")}
      >
        המשך לפריטים →
      </button>
    </div>
  );

  // ── Step 2: Items ─────────────────────────────────────────────────────────
  const renderItemsStep = () => (
    <div className="flex flex-col gap-3 min-h-0">
      {/* Price list items picker */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pr-10 text-sm"
              placeholder="חיפוש פריט..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setCustomLine(!customLine)}
            className={cn("btn-secondary text-xs px-2.5 py-2", customLine && "bg-brand-50 border-brand-300 text-brand-600")}
          >
            <Plus className="w-3.5 h-3.5" /> מותאם
          </button>
        </div>

        {/* Custom line form */}
        {customLine && (
          <div className="p-3 bg-slate-50 rounded-xl border border-petra-border mb-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input text-sm"
                placeholder="שם פריט *"
                value={newLine.name}
                onChange={(e) => setNewLine({ ...newLine, name: e.target.value })}
              />
              <select
                className="input text-sm"
                value={newLine.unit}
                onChange={(e) => setNewLine({ ...newLine, unit: e.target.value })}
              >
                {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" min="0" step="0.01"
                className="input text-sm"
                placeholder="מחיר ₪"
                value={newLine.unitPrice || ""}
                onChange={(e) => setNewLine({ ...newLine, unitPrice: parseFloat(e.target.value) || 0 })}
                dir="ltr"
              />
              <input
                type="number" min="0.5" step="0.5"
                className="input text-sm"
                placeholder="כמות"
                value={newLine.quantity}
                onChange={(e) => setNewLine({ ...newLine, quantity: parseFloat(e.target.value) || 1 })}
                dir="ltr"
              />
            </div>
            <button
              onClick={() => {
                if (!newLine.name || newLine.unitPrice < 0) return;
                setLines([...lines, { ...newLine }]);
                setNewLine({ priceListItemId: null, name: "", unit: "per_session", quantity: 1, unitPrice: 0, taxMode: "taxable", petIds: [] });
                setCustomLine(false);
              }}
              className="btn-primary w-full text-sm py-1.5"
              disabled={!newLine.name}
            >
              הוסף שורה
            </button>
          </div>
        )}

        {/* Boarding units reminder banner */}
        {isBoardingOrder && boardingNights !== null && (
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-100 rounded-xl mb-2 text-xs text-brand-600">
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              שהייה: {boardingCheckInDate} {boardingCheckInTime} → {boardingCheckOutDate} {boardingCheckOutTime}
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

        {/* Items grid */}
        <div className="max-h-48 overflow-y-auto grid grid-cols-1 gap-1">
          {filteredItems.map((item) => {
            const inCart = lines.some((l) => l.priceListItemId === item.id);
            return (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-right transition-all",
                  inCart
                    ? "border-brand-200 bg-brand-50"
                    : "border-petra-border hover:border-brand-200 hover:bg-brand-50/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">{item.name}</p>
                  {item.category && <p className="text-xs text-petra-muted">{item.category}</p>}
                </div>
                <span className="text-sm font-bold text-petra-text flex-shrink-0">₪{item.basePrice}</span>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                  inCart ? "bg-brand-500" : "bg-slate-100"
                )}>
                  <Plus className={cn("w-3 h-3", inCart ? "text-white" : "text-slate-400")} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart lines */}
      {lines.length > 0 && (
        <div className="border border-petra-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-petra-border">
            <span className="text-xs font-semibold text-petra-muted">עגלה ({lines.length} פריטים)</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="border-b border-petra-border last:border-0 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-petra-text truncate block">{line.name}</span>
                  {line.petIds.length > 0 && (
                    <span className="text-[11px] text-brand-600 block mt-0.5" dir="rtl">
                      {line.petIds.map(id => customerPets.find(p => p.id === id)?.name).filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => updateQty(i, -1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all text-petra-muted"
                    title="הפחת כמות"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-medium w-8 text-center">{line.quantity}</span>
                  <button
                    onClick={() => updateQty(i, 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all text-petra-muted"
                    title="הוסף כמות"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-sm font-bold text-petra-text flex-shrink-0 w-16 text-left">
                  {fmt(line.quantity * line.unitPrice)}
                </span>
                <button onClick={() => removeLine(i)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all text-slate-300">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Pet selection for this specific line (only show inline if there are pets) */}
              {customerPets.length > 0 && (
                <div className="px-3 pb-2.5 pt-1 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-petra-muted mb-1.5 flex items-center gap-1">
                    🐾 בחירת כלבים רלוונטיים:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {customerPets.map((pet) => {
                      const isSelected = line.petIds.includes(pet.id);
                      return (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => {
                            setLines(prev => prev.map((l, idx) => {
                              if (idx !== i) return l;

                              let newPetIds = [...l.petIds];
                              if (isSelected) {
                                newPetIds = newPetIds.filter(id => id !== pet.id);
                              } else {
                                newPetIds.push(pet.id);
                              }

                              // Auto update quantity if multiplier is 1 (heuristic: user probably wants quantity = number of dogs)
                              let newQuantity = l.quantity;
                              if (newPetIds.length > 0) {
                                newQuantity = newPetIds.length;
                              } else {
                                newQuantity = 1;
                              }

                              return { ...l, petIds: newPetIds, quantity: newQuantity };
                            }));
                          }}
                          className={cn(
                            "text-[11px] px-2 py-1 rounded-md border flex items-center gap-1 transition-colors",
                            isSelected
                              ? "bg-brand-50 border-brand-300 text-brand-700"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          )}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-brand-500" />}
                          {pet.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Discount */}
      {lines.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <select
            className="input text-sm"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "none" | "percent" | "fixed")}
          >
            <option value="none">ללא הנחה</option>
            <option value="percent">הנחה באחוזים (%)</option>
            <option value="fixed">הנחה בסכום קבוע (₪)</option>
          </select>
          {discountType !== "none" && (
            <input
              type="number" min="0" step="0.01"
              className="input text-sm"
              placeholder={discountType === "percent" ? "% הנחה" : "₪ הנחה"}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              dir="ltr"
            />
          )}
        </div>
      )}

      <button
        className="btn-primary w-full"
        disabled={lines.length === 0}
        onClick={() => setStep("review")}
      >
        המשך לסיכום ({fmt(calc.total)}) →
      </button>
    </div>
  );

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

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-brand-500" />
              הזמנה חדשה
            </h2>
            {/* Stepper */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {(["customer", "items", "review", "payment"] as const).map((s, i) => {
                const labels = ["לקוח", "פריטים", "סיכום", "תשלום"];
                const stepOrder = { customer: 0, items: 1, review: 2, payment: 3 };
                const currentIdx = stepOrder[step];
                const done = i < currentIdx;
                const active = step === s;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all",
                      active ? "bg-brand-500 text-white" :
                        done ? "bg-emerald-500 text-white" :
                          "bg-slate-200 text-slate-400"
                    )}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={cn("text-xs", active ? "text-brand-600 font-semibold" : "text-slate-400")}>
                      {labels[i]}
                    </span>
                    {i < 3 && <div className="w-4 h-px bg-slate-200" />}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Back button */}
        {step !== "customer" && step !== "payment" && (
          <button
            onClick={() => setStep(step === "review" ? "items" : "customer")}
            className="text-xs text-petra-muted hover:text-petra-text mb-3 flex items-center gap-1"
          >
            ← חזרה
          </button>
        )}

        {step === "customer" && renderCustomerStep()}
        {step === "items" && renderItemsStep()}
        {step === "review" && renderReviewStep()}
        {step === "payment" && renderPaymentStep()}
      </div>
    </div>
  );
}
