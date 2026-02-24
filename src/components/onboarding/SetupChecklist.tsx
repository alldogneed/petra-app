"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Link from "next/link";
import { Circle, ChevronLeft, X, Rocket } from "lucide-react";
import { SETUP_STEPS, countCompletedSteps } from "@/lib/onboarding-state";

interface OnboardingProgress {
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4: boolean;
  skipped: boolean;
  completedAt: string | null;
}

function isCompleted(progress: OnboardingProgress, step: number): boolean {
  if (step === 1) return progress.stepCompleted1;
  if (step === 2) return progress.stepCompleted2;
  if (step === 3) return progress.stepCompleted3;
  if (step === 4) return progress.stepCompleted4;
  return false;
}

export function SetupChecklist() {
  const queryClient = useQueryClient();

  const { data: progress, isLoading } = useQuery<OnboardingProgress & { startedAt: string | null }>({
    queryKey: ["onboarding-progress"],
    queryFn: () => fetch("/api/onboarding/progress").then((r) => r.json()),
    staleTime: 30_000,
  });

  // Mark startedAt when user first sees the checklist
  useEffect(() => {
    if (progress && !progress.startedAt && !progress.skipped && !progress.completedAt) {
      fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: new Date().toISOString() }),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
      }).catch(() => {});
    }
  }, [progress, queryClient]);

  const skipMutation = useMutation({
    mutationFn: () =>
      fetch("/api/onboarding/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipped: true }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  // Don't render if loading, skipped, or fully completed
  if (isLoading || !progress) return null;
  if (progress.skipped || progress.completedAt) return null;

  const completed = countCompletedSteps(progress);
  const total = SETUP_STEPS.length;
  const allDone = completed === total;

  // If all steps done, mark completed and hide
  if (allDone && !progress.completedAt) {
    fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
      })
      .catch(() => { /* silently ignore completion mark failure */ });
    return null;
  }

  const pct = Math.round((completed / total) * 100);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1e3a5f 100%)",
        borderColor: "rgba(249,115,22,0.25)",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}
            >
              <Rocket className="w-5 h-5" style={{ color: "#F97316" }} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white leading-tight">
                הגדרת העסק
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {completed} מתוך {total} שלבים הושלמו
              </p>
            </div>
          </div>
          <button
            onClick={() => skipMutation.mutate()}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors flex-shrink-0"
            title="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">{pct}% הושלם</span>
          </div>
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #F97316 0%, #FB923C 100%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Steps — only show incomplete ones */}
      <div className="px-3 pb-4 space-y-1">
        {SETUP_STEPS.filter((step) => !isCompleted(progress, step.step)).map((step) => {
          const href = step.hrefQuery
            ? `${step.href}?${step.hrefQuery}`
            : step.href;

          return (
            <Link
              key={step.step}
              href={href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all group hover:bg-white/[0.06] cursor-pointer"
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>

              {/* Emoji + text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{step.icon}</span>
                  <span className="text-sm font-medium leading-tight text-white">
                    {step.title}
                  </span>
                  {step.step === 2 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: "rgba(249,115,22,0.2)",
                        color: "#FB923C",
                        border: "1px solid rgba(249,115,22,0.3)",
                      }}
                    >
                      חשוב
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  {step.description}
                </p>
              </div>

              {/* Arrow */}
              <ChevronLeft className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
