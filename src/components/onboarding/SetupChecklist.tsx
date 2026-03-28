"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronLeft, X, Rocket, Sparkles } from "lucide-react";
import { SETUP_STEPS, countCompletedSteps, CORE_STEPS } from "@/lib/onboarding-state";

interface OnboardingProgress {
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  stepCompleted4: boolean;
  stepCompleted5?: boolean;
  stepCompleted6?: boolean;
  stepCompleted7?: boolean;
  skipped: boolean;
  completedAt: string | null;
}

function isCompleted(progress: OnboardingProgress, step: number): boolean {
  if (step === 1) return progress.stepCompleted1;
  if (step === 2) return progress.stepCompleted2;
  if (step === 3) return progress.stepCompleted3;
  if (step === 4) return progress.stepCompleted4;
  if (step === 5) return progress.stepCompleted5 ?? false;
  if (step === 6) return progress.stepCompleted6 ?? false;
  if (step === 7) return progress.stepCompleted7 ?? false;
  return false;
}

export function SetupChecklist() {
  const queryClient = useQueryClient();

  const { data: progress, isLoading } = useQuery<OnboardingProgress & { startedAt: string | null }>({
    queryKey: ["onboarding-progress"],
    queryFn: () =>
      fetch("/api/onboarding/progress")
        .then((r) => r.json())
        .then((d) => d.progress ?? null),
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

  // Don't render if loading, skipped, or fully completed (all 7 done)
  if (isLoading || !progress) return null;
  if (progress.skipped || progress.completedAt) return null;

  const completed = countCompletedSteps(progress);
  const total = SETUP_STEPS.length;

  // If all 7 steps done, mark completed and hide
  if (completed === total && !progress.completedAt) {
    fetch("/api/onboarding/progress", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
      })
      .catch(() => {});
    return null;
  }

  const coreSteps = SETUP_STEPS.filter((s) => !s.advanced);
  const advancedSteps = SETUP_STEPS.filter((s) => s.advanced);
  const completedCore = coreSteps.filter((s) => isCompleted(progress, s.step)).length;
  const coreAllDone = completedCore === CORE_STEPS;
  const incompleteCore = coreSteps.filter((s) => !isCompleted(progress, s.step));
  const incompleteAdvanced = advancedSteps.filter((s) => !isCompleted(progress, s.step));
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

      {/* Core steps */}
      {incompleteCore.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {incompleteCore.map((step) => {
            const href = step.hrefQuery ? `${step.href}?${step.hrefQuery}` : step.href;
            return (
              <Link
                key={step.step}
                href={href}
                className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all group hover:bg-white/[0.06] cursor-pointer"
              >
                <div className="flex-shrink-0">
                  <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
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
                <ChevronLeft className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Advanced steps — shown only after core is fully done, or always if some advanced are incomplete */}
      {incompleteAdvanced.length > 0 && (
        <>
          {/* Divider with label */}
          <div className="px-5 py-2.5 flex items-center gap-2">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" style={{ color: "#FB923C" }} />
              <span className="text-[11px] font-medium" style={{ color: "#FB923C" }}>
                קחו יותר מפטרה
              </span>
            </div>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>

          <div className="px-3 pb-4 space-y-1">
            {incompleteAdvanced.map((step) => {
              const href = step.hrefQuery ? `${step.href}?${step.hrefQuery}` : step.href;
              return (
                <Link
                  key={step.step}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group hover:bg-white/[0.06] cursor-pointer"
                >
                  <div className="flex-shrink-0">
                    <Circle className="w-4 h-4 text-slate-700 group-hover:text-slate-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm leading-none">{step.icon}</span>
                      <span className="text-sm font-medium leading-tight text-slate-300 group-hover:text-white transition-colors">
                        {step.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                      {step.description}
                    </p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* All core done + some advanced done — show a completion nudge */}
      {coreAllDone && incompleteAdvanced.length === 0 && (
        <div className="px-5 pb-5 pt-1 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#4ade80" }} />
          <p className="text-xs text-slate-400">
            העסק שלך מוכן לחלוטין — כל הכבוד! 🎉
          </p>
        </div>
      )}
    </div>
  );
}
