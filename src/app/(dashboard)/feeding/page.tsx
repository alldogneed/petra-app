"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  PawPrint,
  RefreshCw,
  CheckCircle2,
  Hotel,
  UtensilsCrossed,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  Pencil,
  Plus,
  Pill,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medication {
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
}

interface BoardingStay {
  id: string;
  petId: string;
  customerId: string;
  status: string;
  checkIn: string;
  checkOut: string | null;
  feedingPlan: string | null;
  pet: {
    id: string;
    name: string;
    breed: string | null;
    foodNotes: string | null;
    foodBrand: string | null;
    foodGramsPerDay: number | null;
    foodFrequency: string | null;
    medications: Medication[];
    serviceDogProfile: { id: string } | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
}

interface FeedingPlan {
  foodType: string;
  amountGrams: number;
  timesPerDay: number;
  notes?: string;
}

function parseFeedingPlan(raw: string | null): FeedingPlan | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FeedingPlan;
  } catch {
    return null;
  }
}

interface MealRecord {
  done: boolean;
  doneAt: string | null;
}

type MealSlot = "breakfast" | "lunch" | "dinner";

interface DailyMeals {
  breakfast: MealRecord;
  lunch: MealRecord;
  dinner: MealRecord;
}

const MEAL_LABELS: Record<MealSlot, { label: string; emoji: string }> = {
  breakfast: { label: "ארוחת בוקר", emoji: "🌅" },
  lunch: { label: "ארוחת צהריים", emoji: "☀️" },
  dinner: { label: "ארוחת ערב", emoji: "🌙" },
};

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function storageKey(petId: string, dateStr: string, slot: MealSlot): string {
  return `feeding:${dateStr}:${petId}:${slot}`;
}

function loadMeal(petId: string, dateStr: string, slot: MealSlot): MealRecord {
  if (typeof window === "undefined")
    return { done: false, doneAt: null };
  try {
    const raw = localStorage.getItem(storageKey(petId, dateStr, slot));
    if (!raw) return { done: false, doneAt: null };
    return JSON.parse(raw) as MealRecord;
  } catch {
    return { done: false, doneAt: null };
  }
}

function saveMeal(
  petId: string,
  dateStr: string,
  slot: MealSlot,
  record: MealRecord
) {
  try {
    localStorage.setItem(
      storageKey(petId, dateStr, slot),
      JSON.stringify(record)
    );
  } catch {
    // ignore quota errors
  }
}

function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function isStayActiveOnDate(stay: BoardingStay, date: Date): boolean {
  const checkIn = new Date(stay.checkIn);
  const checkOut = stay.checkOut ? new Date(stay.checkOut) : null;
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  // stay must have checked in by end of day and either not checked out or checked out after day start
  return (
    checkIn <= dayEnd &&
    (checkOut === null || checkOut >= dayStart) &&
    ["reserved", "checked_in"].includes(stay.status)
  );
}

function formatHebrewDate(d: Date): string {
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Feeding Plan Modal ───────────────────────────────────────────────────────

function parsePetFrequency(freq: string | null): string {
  if (!freq) return "2";
  const match = freq.match(/^(\d)/);
  return match ? match[1] : "2";
}

function FeedingPlanModal({
  stay,
  onClose,
  onSave,
}: {
  stay: BoardingStay;
  onClose: () => void;
  onSave: (stayId: string, plan: FeedingPlan) => void;
}) {
  const existing = parseFeedingPlan(stay.feedingPlan);
  // Pre-populate from pet profile if no boarding-level plan exists
  const [foodType, setFoodType] = useState(existing?.foodType ?? stay.pet.foodBrand ?? "");
  const [amountGrams, setAmountGrams] = useState(
    existing?.amountGrams ? String(existing.amountGrams) :
    stay.pet.foodGramsPerDay ? String(stay.pet.foodGramsPerDay) : ""
  );
  const [timesPerDay, setTimesPerDay] = useState(
    existing?.timesPerDay ? String(existing.timesPerDay) :
    parsePetFrequency(stay.pet.foodFrequency)
  );
  const [notes, setNotes] = useState(existing?.notes ?? stay.pet.foodNotes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foodType.trim() || !amountGrams) return;
    onSave(stay.id, {
      foodType: foodType.trim(),
      amountGrams: Number(amountGrams),
      timesPerDay: Number(timesPerDay),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-petra-text">תוכנית האכלה</h2>
            <p className="text-sm text-petra-muted">{stay.pet.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-petra-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Food type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-petra-text">
              סוג האוכל <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
              placeholder="לדוג׳ Royal Canin Medium Adult"
              className="input w-full"
              required
              autoFocus
            />
          </div>

          {/* Amount + times per day side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-petra-text">
                כמות בגרם <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={amountGrams}
                onChange={(e) => setAmountGrams(e.target.value)}
                placeholder="200"
                min={1}
                max={5000}
                className="input w-full"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-petra-text">
                כמה פעמים ביום
              </label>
              <select
                value={timesPerDay}
                onChange={(e) => setTimesPerDay(e.target.value)}
                className="input w-full"
              >
                <option value="1">פעם אחת</option>
                <option value="2">פעמיים</option>
                <option value="3">שלוש פעמים</option>
                <option value="4">ארבע פעמים</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-petra-text">
              הערות האכלה
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הוראות מיוחדות, אלרגיות, העדפות..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              ביטול
            </button>
            <button
              type="submit"
              disabled={!foodType.trim() || !amountGrams}
              className="btn-primary flex-1"
            >
              שמור
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Meal Toggle Button ───────────────────────────────────────────────────────

function MealButton({
  slot,
  record,
  onToggle,
}: {
  slot: MealSlot;
  record: MealRecord;
  onToggle: () => void;
}) {
  const { label, emoji } = MEAL_LABELS[slot];

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all select-none active:scale-95",
        record.done
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-white border-slate-200 text-petra-muted hover:border-brand-300 hover:bg-brand-50"
      )}
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-medium text-center leading-tight">{label}</span>
      {record.done ? (
        <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
          <Check className="w-3 h-3" />
          {record.doneAt
            ? new Date(record.doneAt).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "בוצע"}
        </span>
      ) : (
        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
          <X className="w-3 h-3" />
          לא בוצע
        </span>
      )}
    </button>
  );
}

// ─── Medications Board ────────────────────────────────────────────────────────

const MED_TIME_LABELS: Record<string, string> = {
  morning: "בוקר",
  noon: "צהריים",
  evening: "ערב",
  night: "לילה",
};

function MedicationsBoard({
  stays,
  dateStr,
}: {
  stays: BoardingStay[];
  dateStr: string;
}) {
  const [given, setGiven] = useState<Record<string, boolean>>({});

  // Load given-state from localStorage on date/stays change
  useEffect(() => {
    const loaded: Record<string, boolean> = {};
    for (const stay of stays) {
      for (const med of stay.pet.medications) {
        const key = `med:${dateStr}:${stay.petId}:${med.medName}`;
        try {
          loaded[key] = localStorage.getItem(key) === "1";
        } catch {
          loaded[key] = false;
        }
      }
    }
    setGiven(loaded);
  }, [stays, dateStr]);

  function toggleGiven(petId: string, medName: string) {
    const key = `med:${dateStr}:${petId}:${medName}`;
    const next = !given[key];
    try {
      if (next) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
    setGiven((prev) => ({ ...prev, [key]: next }));
  }

  // Only show stays with medications
  const staysWithMeds = stays.filter((s) => s.pet.medications.length > 0);

  if (staysWithMeds.length === 0) {
    return (
      <div className="card p-12 text-center space-y-3">
        <Pill className="w-10 h-10 mx-auto text-slate-300" />
        <p className="text-petra-muted text-sm">אין כלבים עם תרופות פעילות בפנסיון</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {staysWithMeds.map((stay) => {
        const allGiven = stay.pet.medications.every(
          (m) => given[`med:${dateStr}:${stay.petId}:${m.medName}`]
        );
        return (
          <div
            key={stay.id}
            className={cn(
              "card overflow-hidden transition-all",
              allGiven && "opacity-70"
            )}
          >
            {/* Card header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  allGiven ? "bg-emerald-100" : "bg-purple-50"
                )}>
                  {allGiven
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Pill className="w-4 h-4 text-purple-500" />
                  }
                </div>
                <div>
                  <p className={cn("font-medium text-sm", allGiven ? "line-through text-petra-muted" : "text-petra-text")}>
                    {stay.pet.name}
                    {stay.pet.breed && (
                      <span className="text-xs text-petra-muted font-normal mr-1">({stay.pet.breed})</span>
                    )}
                    {stay.pet.serviceDogProfile && (
                      <span className="mr-2 badge badge-blue text-[10px]">כלב שירות</span>
                    )}
                  </p>
                  <Link
                    href={`/customers/${stay.customer.id}`}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                  >
                    <User className="w-3 h-3" />
                    {stay.customer.name}
                  </Link>
                </div>
              </div>
              <span className="text-xs text-petra-muted">
                {stay.pet.medications.length} תרופות
              </span>
            </div>

            {/* Medications list */}
            <div className="p-4 space-y-3">
              {stay.pet.medications.map((med) => {
                const key = `med:${dateStr}:${stay.petId}:${med.medName}`;
                const isGiven = given[key] ?? false;
                const times = med.times
                  ? med.times.split(",").map((t) => MED_TIME_LABELS[t.trim()] ?? t.trim()).join(", ")
                  : null;

                return (
                  <div
                    key={med.medName}
                    className={cn(
                      "flex items-start justify-between gap-3 p-3 rounded-xl border transition-all",
                      isGiven
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-white border-slate-200"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-sm",
                        isGiven ? "text-emerald-800 line-through" : "text-petra-text"
                      )}>
                        {med.medName}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {med.dosage && (
                          <span className="text-xs text-petra-muted">{med.dosage}</span>
                        )}
                        {med.frequency && (
                          <span className="text-xs text-petra-muted">{med.frequency}</span>
                        )}
                        {times && (
                          <span className="flex items-center gap-1 text-xs text-petra-muted">
                            <Clock className="w-3 h-3" />
                            {times}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleGiven(stay.petId, med.medName)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex-shrink-0",
                        isGiven
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : "bg-slate-100 text-petra-text hover:bg-purple-100 hover:text-purple-700"
                      )}
                    >
                      {isGiven ? (
                        <><Check className="w-3.5 h-3.5" /> ניתן</>
                      ) : (
                        <><Pill className="w-3.5 h-3.5" /> סמן כניתן</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-petra-muted text-center">
        סטטוס מתן תרופות נשמר מקומית בדפדפן
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeedingPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const dateStr = dateToISO(currentDate);
  const [editPlanStay, setEditPlanStay] = useState<BoardingStay | null>(null);
  const [activeTab, setActiveTab] = useState<"feeding" | "medications">("feeding");

  const queryClient = useQueryClient();

  // Local state for all meal records, keyed by "petId:slot"
  const [meals, setMeals] = useState<Record<string, MealRecord>>({});

  const { data: stays, isLoading, isError, refetch, isFetching } = useQuery<
    BoardingStay[]
  >({
    queryKey: ["boarding-stays-feeding"],
    queryFn: () => fetch("/api/boarding").then((r) => r.json()),
    staleTime: 60000,
  });

  const savePlanMutation = useMutation({
    mutationFn: async ({ stayId, plan }: { stayId: string; plan: FeedingPlan }) => {
      const res = await fetch(`/api/boarding/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedingPlan: JSON.stringify(plan) }),
      });
      if (!res.ok) throw new Error("שגיאה בשמירת תוכנית האכלה");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boarding-stays-feeding"] });
      toast.success("תוכנית האכלה נשמרה");
      setEditPlanStay(null);
    },
    onError: () => toast.error("שגיאה בשמירת תוכנית האכלה"),
  });

  // Filter stays active on current date — memoized to prevent identity changes on every render
  const activePets = useMemo(
    () => (stays ?? []).filter((s) => isStayActiveOnDate(s, currentDate)),
    [stays, currentDate]
  );

  // Load meal data from localStorage whenever date or activePets change
  useEffect(() => {
    const loaded: Record<string, MealRecord> = {};
    for (const stay of activePets) {
      for (const slot of MEAL_SLOTS) {
        loaded[`${stay.petId}:${slot}`] = loadMeal(stay.petId, dateStr, slot);
      }
    }
    setMeals(loaded);
  }, [activePets, dateStr]);

  function toggleMeal(petId: string, slot: MealSlot) {
    const key = `${petId}:${slot}`;
    const current = meals[key] ?? { done: false, doneAt: null };
    const next: MealRecord = {
      done: !current.done,
      doneAt: !current.done ? new Date().toISOString() : null,
    };
    saveMeal(petId, dateStr, slot, next);
    setMeals((prev) => ({ ...prev, [key]: next }));
  }

  const totalMeals = activePets.length * MEAL_SLOTS.length;
  const doneMeals = Object.values(meals).filter((m) => m.done).length;
  const allDone = totalMeals > 0 && doneMeals === totalMeals;

  const isToday = dateToISO(new Date()) === dateStr;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <BoardingTabs />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("feeding")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "feeding"
              ? "bg-white text-petra-text shadow-sm"
              : "text-petra-muted hover:text-petra-text"
          )}
        >
          <UtensilsCrossed className="w-4 h-4" />
          לוח האכלה
        </button>
        <button
          onClick={() => setActiveTab("medications")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "medications"
              ? "bg-white text-petra-text shadow-sm"
              : "text-petra-muted hover:text-petra-text"
          )}
        >
          <Pill className="w-4 h-4" />
          לוח תרופות
          {activePets.filter((s) => s.pet.medications.length > 0).length > 0 && (
            <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {activePets.filter((s) => s.pet.medications.length > 0).length}
            </span>
          )}
        </button>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">לוח האכלה</h1>
          <p className="text-sm text-petra-muted mt-1">
            {formatHebrewDate(currentDate)}
            {isToday && (
              <span className="mr-2 badge badge-brand">היום</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date nav */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setCurrentDate((d) => addDays(d, 1))}
              className="px-3 py-2 hover:bg-slate-50 text-petra-muted transition-colors"
              title="אתמול"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                isToday ? "text-brand-600" : "text-petra-muted hover:text-petra-text"
              )}
            >
              היום
            </button>
            <button
              onClick={() => setCurrentDate((d) => addDays(d, -1))}
              className="px-3 py-2 hover:bg-slate-50 text-petra-muted transition-colors"
              title="מחר"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Progress */}
          {!isLoading && activePets.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  allDone ? "text-emerald-600" : "text-petra-text"
                )}
              >
                {doneMeals}/{totalMeals}
              </span>
              <span className="text-petra-muted">האכלות</span>
              {allDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary gap-2 inline-flex items-center"
          >
            <RefreshCw
              className={cn("w-4 h-4", isFetching && "animate-spin")}
            />
            רענן
          </button>
        </div>
      </div>

      {activeTab === "medications" && !isLoading && !isError && (
        <MedicationsBoard stays={activePets} dateStr={dateStr} />
      )}

      {activeTab === "feeding" && <>

      {/* Progress bar */}
      {!isLoading && totalMeals > 0 && (
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 right-0 rounded-full transition-all duration-500",
              allDone ? "bg-emerald-400" : "bg-brand-400"
            )}
            style={{ width: `${(doneMeals / totalMeals) * 100}%` }}
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="card p-10 text-center text-petra-muted text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
          טוען...
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">
          שגיאה בטעינת הנתונים
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && activePets.length === 0 && (
        <div className="card p-12 text-center space-y-3">
          <Hotel className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-petra-muted text-sm">
            אין כלבים בפנסיון בתאריך זה
          </p>
          <Link href="/boarding" className="text-sm text-brand-500 hover:underline">
            עבור ללוח הפנסיון
          </Link>
        </div>
      )}

      {/* All done banner */}
      {allDone && activePets.length > 0 && (
        <div className="card p-5 bg-emerald-50 border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">
              כל ההאכלות הושלמו!
            </p>
            <p className="text-sm text-emerald-600">
              כל {activePets.length} הכלבים האכילו ב
              {isToday ? "יום" : "תאריך"} זה
            </p>
          </div>
        </div>
      )}

      {/* Pet feeding table */}
      {!isLoading && !isError && activePets.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-header-cell">שם הכלב</th>
                  <th className="table-header-cell">הוראות האכלה</th>
                  <th className="table-header-cell text-center">
                    {MEAL_LABELS.breakfast.emoji} בוקר
                  </th>
                  <th className="table-header-cell text-center">
                    {MEAL_LABELS.lunch.emoji} צהריים
                  </th>
                  <th className="table-header-cell text-center">
                    {MEAL_LABELS.dinner.emoji} ערב
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activePets.map((stay) => {
                  const petDoneMeals = MEAL_SLOTS.filter(
                    (s) => meals[`${stay.petId}:${s}`]?.done
                  ).length;
                  const petAllDone = petDoneMeals === MEAL_SLOTS.length;

                  return (
                    <tr
                      key={stay.id}
                      className={cn(
                        "hover:bg-slate-50 transition-colors",
                        petAllDone && "opacity-75"
                      )}
                    >
                      {/* Pet info */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              petAllDone ? "bg-emerald-100" : "bg-brand-50"
                            )}
                          >
                            {petAllDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <PawPrint className="w-4 h-4 text-brand-500" />
                            )}
                          </div>
                          <div>
                            <p
                              className={cn(
                                "font-medium",
                                petAllDone
                                  ? "text-petra-muted line-through"
                                  : "text-petra-text"
                              )}
                            >
                              {stay.pet.name}
                              {stay.pet.breed && (
                                <span className="text-xs text-petra-muted font-normal mr-1">
                                  ({stay.pet.breed})
                                </span>
                              )}
                            </p>
                            <Link
                              href={`/customers/${stay.customer.id}`}
                              className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                            >
                              <User className="w-3 h-3" />
                              {stay.customer.name}
                            </Link>
                          </div>
                        </div>
                      </td>

                      {/* Feeding plan */}
                      <td className="table-cell">
                        {(() => {
                          const plan = parseFeedingPlan(stay.feedingPlan);
                          return (
                            <div className="flex items-start gap-2 max-w-xs">
                              <div className="flex-1 min-w-0">
                                {plan ? (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 space-y-0.5">
                                    <p className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-0.5">
                                      <UtensilsCrossed className="w-3 h-3" />
                                      תוכנית פנסיון
                                    </p>
                                    <p className="text-xs text-amber-900 font-medium">{plan.foodType}</p>
                                    <p className="text-xs text-amber-700">
                                      {plan.amountGrams}ג׳ · {plan.timesPerDay}× ביום
                                    </p>
                                    {plan.notes && (
                                      <p className="text-xs text-amber-600 leading-snug">{plan.notes}</p>
                                    )}
                                  </div>
                                ) : (stay.pet.foodBrand || stay.pet.foodGramsPerDay || stay.pet.foodFrequency || stay.pet.foodNotes) ? (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 space-y-0.5">
                                    <p className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-0.5">
                                      <UtensilsCrossed className="w-3 h-3" />
                                      מפרופיל הכלב
                                    </p>
                                    {stay.pet.foodBrand && (
                                      <p className="text-xs text-amber-900 font-medium">{stay.pet.foodBrand}</p>
                                    )}
                                    <div className="flex gap-2 text-xs text-amber-700">
                                      {stay.pet.foodGramsPerDay && <span>{stay.pet.foodGramsPerDay}ג׳/יום</span>}
                                      {stay.pet.foodFrequency && <span>{stay.pet.foodFrequency}</span>}
                                    </div>
                                    {stay.pet.foodNotes && (
                                      <p className="text-xs text-amber-600 leading-snug">{stay.pet.foodNotes}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-petra-muted text-xs">אין תוכנית</span>
                                )}
                              </div>
                              <button
                                onClick={() => setEditPlanStay(stay)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-petra-muted hover:text-brand-600 transition-colors flex-shrink-0 mt-0.5"
                                title={plan ? "ערוך תוכנית האכלה" : "הוסף תוכנית האכלה"}
                              >
                                {plan ? (
                                  <Pencil className="w-3.5 h-3.5" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Meal slots */}
                      {MEAL_SLOTS.map((slot) => {
                        const record = meals[`${stay.petId}:${slot}`] ?? {
                          done: false,
                          doneAt: null,
                        };
                        return (
                          <td key={slot} className="table-cell text-center">
                            <button
                              onClick={() => toggleMeal(stay.petId, slot)}
                              className={cn(
                                "inline-flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all active:scale-90",
                                record.done
                                  ? "bg-emerald-100 border-emerald-400 text-emerald-600"
                                  : "bg-white border-slate-200 text-slate-400 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                              )}
                              title={
                                record.done
                                  ? `בוטל סימון – ${MEAL_LABELS[slot].label}`
                                  : `סמן ${MEAL_LABELS[slot].label}`
                              }
                            >
                              {record.done ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                            {record.done && record.doneAt && (
                              <p className="text-[10px] text-emerald-600 mt-0.5">
                                {new Date(record.doneAt).toLocaleTimeString(
                                  "he-IL",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note about localStorage */}
      {activePets.length > 0 && (
        <p className="text-xs text-petra-muted text-center">
          נתוני ההאכלה נשמרים מקומית בדפדפן (localStorage) לצרכי דמו
        </p>
      )}

      </> /* end activeTab === "feeding" */}

      {/* Feeding plan modal */}
      {editPlanStay && (
        <FeedingPlanModal
          stay={editPlanStay}
          onClose={() => setEditPlanStay(null)}
          onSave={(stayId, plan) => savePlanMutation.mutate({ stayId, plan })}
        />
      )}
    </div>
  );
}
