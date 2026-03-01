"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardingStay {
  id: string;
  petId: string;
  customerId: string;
  status: string;
  checkIn: string;
  checkOut: string | null;
  pet: {
    id: string;
    name: string;
    breed: string | null;
    foodNotes: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeedingPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const dateStr = dateToISO(currentDate);

  // Local state for all meal records, keyed by "petId:slot"
  const [meals, setMeals] = useState<Record<string, MealRecord>>({});

  const { data: stays, isLoading, isError, refetch, isFetching } = useQuery<
    BoardingStay[]
  >({
    queryKey: ["boarding-stays-feeding"],
    queryFn: () => fetch("/api/boarding").then((r) => r.json()),
    staleTime: 60000,
  });

  // Filter stays active on current date
  const activePets = (stays ?? []).filter((s) =>
    isStayActiveOnDate(s, currentDate)
  );

  // Load meal data from localStorage whenever date or activePets change
  const loadAllMeals = useCallback(() => {
    const loaded: Record<string, MealRecord> = {};
    for (const stay of activePets) {
      for (const slot of MEAL_SLOTS) {
        loaded[`${stay.petId}:${slot}`] = loadMeal(stay.petId, dateStr, slot);
      }
    }
    setMeals(loaded);
  }, [activePets, dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAllMeals();
  }, [loadAllMeals]);

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

                      {/* Food notes */}
                      <td className="table-cell">
                        {stay.pet.foodNotes ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 max-w-xs">
                            <p className="text-xs font-medium text-amber-700 flex items-center gap-1 mb-0.5">
                              <UtensilsCrossed className="w-3 h-3" />
                              הוראות
                            </p>
                            <p className="text-xs text-amber-800 leading-snug">
                              {stay.pet.foodNotes}
                            </p>
                          </div>
                        ) : (
                          <span className="text-petra-muted text-xs">אין הוראות</span>
                        )}
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
    </div>
  );
}
