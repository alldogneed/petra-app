"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  PawPrint,
  RefreshCw,
  CheckCircle2,
  Hotel,
  UtensilsCrossed,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MealSlot {
  slot: string;
  label: string;
  emoji: string;
  taskId: string;
  done: boolean;
  completedAt: string | null;
}

interface FeedingPet {
  stayId: string;
  petId: string;
  petName: string;
  petBreed: string | null;
  customerId: string;
  customerName: string;
  foodNotes: string | null;
  feedingPlan: string | null;
  checkIn: string;
  meals: MealSlot[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function todayHebrew() {
  return new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedingPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    pets: FeedingPet[];
    date: string;
  }>({
    queryKey: ["feeding-board"],
    queryFn: () => fetch("/api/feeding").then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000, // refresh every minute
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: done ? "COMPLETED" : "OPEN" }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeding-board"] });
    },
  });

  const pets = data?.pets ?? [];
  const totalMeals = pets.reduce((s, p) => s + p.meals.length, 0);
  const doneMeals = pets.reduce((s, p) => s + p.meals.filter((m) => m.done).length, 0);
  const allDone = totalMeals > 0 && doneMeals === totalMeals;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">לוח האכלה</h1>
          <p className="text-sm text-petra-muted mt-1">{todayHebrew()}</p>
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && pets.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className={cn(
                "font-semibold tabular-nums",
                allDone ? "text-emerald-600" : "text-petra-text"
              )}>
                {doneMeals}/{totalMeals}
              </span>
              <span className="text-petra-muted">האכלות הושלמו</span>
              {allDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary gap-2 inline-flex items-center"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
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
        <div className="card p-8 text-center text-red-500 text-sm">שגיאה בטעינת הנתונים</div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && pets.length === 0 && (
        <div className="card p-12 text-center space-y-3">
          <Hotel className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-petra-muted text-sm">אין חיות בפנסיון כרגע</p>
          <Link href="/boarding" className="text-sm text-brand-500 hover:underline">
            עבור ללוח הפנסיון
          </Link>
        </div>
      )}

      {/* All done banner */}
      {allDone && pets.length > 0 && (
        <div className="card p-5 bg-emerald-50 border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">כל ההאכלות הושלמו! 🎉</p>
            <p className="text-sm text-emerald-600">כל {pets.length} החיות האכילו היום</p>
          </div>
        </div>
      )}

      {/* Pet cards */}
      <div className="space-y-4">
        {pets.map((pet) => {
          const petDone = pet.meals.every((m) => m.done);
          const petDoneCount = pet.meals.filter((m) => m.done).length;

          return (
            <div
              key={pet.petId}
              className={cn(
                "card p-5 transition-all",
                petDone && "opacity-80 bg-slate-50"
              )}
            >
              {/* Pet header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    petDone ? "bg-emerald-100" : "bg-brand-50"
                  )}>
                    {petDone
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      : <PawPrint className="w-5 h-5 text-brand-500" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold text-base",
                        petDone ? "text-petra-muted line-through" : "text-petra-text"
                      )}>
                        {pet.petName}
                      </span>
                      {pet.petBreed && (
                        <span className="text-xs text-petra-muted">({pet.petBreed})</span>
                      )}
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        petDone
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-brand-50 text-brand-600"
                      )}>
                        {petDoneCount}/{pet.meals.length}
                      </span>
                    </div>
                    <Link
                      href={`/customers/${pet.customerId}`}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:underline mt-0.5"
                    >
                      <User className="w-3 h-3" />
                      {pet.customerName}
                    </Link>
                  </div>
                </div>

                {/* Food notes */}
                {(pet.foodNotes || pet.feedingPlan) && (
                  <div className="flex-1 max-w-xs text-right">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-amber-700 mb-0.5 flex items-center gap-1">
                        <UtensilsCrossed className="w-3 h-3" />
                        הוראות האכלה
                      </p>
                      {pet.feedingPlan && (
                        <p className="text-xs text-amber-800">{pet.feedingPlan}</p>
                      )}
                      {pet.foodNotes && (
                        <p className="text-xs text-amber-700 mt-0.5">{pet.foodNotes}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Meal slots */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {pet.meals.map((meal) => (
                  <button
                    key={meal.taskId}
                    onClick={() =>
                      toggleMutation.mutate({ taskId: meal.taskId, done: !meal.done })
                    }
                    disabled={toggleMutation.isPending}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all select-none",
                      meal.done
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-white border-slate-200 text-petra-muted hover:border-brand-300 hover:bg-brand-50 active:scale-95"
                    )}
                  >
                    <span className="text-xl">{meal.emoji}</span>
                    <span className="text-xs font-medium">{meal.label}</span>
                    {meal.done ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {meal.completedAt ? formatTime(meal.completedAt) : "בוצע"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300">לחץ לסימון</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
