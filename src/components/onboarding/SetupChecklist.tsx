"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronLeft, X, Rocket, AlertTriangle } from "lucide-react";
import { SETUP_STEPS, countCompletedSteps, TOTAL_STEPS } from "@/lib/onboarding-state";

interface OnboardingProgress {
  stepCompleted1: boolean;
  stepCompleted2: boolean;
  stepCompleted3: boolean;
  skipped: boolean;
  completedAt: string | null;
  startedAt: string | null;
}

function isCompleted(progress: OnboardingProgress, step: number): boolean {
  if (step === 1) return progress.stepCompleted1;
  if (step === 2) return progress.stepCompleted2;
  if (step === 3) return progress.stepCompleted3;
  return false;
}

export function SetupChecklist() {
  const queryClient = useQueryClient();

  const { data: progress, isLoading } = useQuery<OnboardingProgress>({
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

  if (isLoading || !progress) return null;

  // Skipped but missing critical setup (no phone) → compact amber banner
  if (progress.skipped && !progress.stepCompleted1) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-800 flex-1">
          חסרים פרטי עסק — חשבוניות ו-WhatsApp לא יעבדו כראוי.
        </p>
        <Link
          href="/settings?tab=business"
          className="text-sm font-semibold text-amber-700 hover:text-amber-900 underline flex-shrink-0"
        >
          השלם עכשיו
        </Link>
      </div>
    );
  }

  // Skipped and basic setup done — don't show anything
  if (progress.skipped || progress.completedAt) return null;

  const completed = countCompletedSteps(progress);
  const total = TOTAL_STEPS;

  // All 3 steps done — mark completedAt and hide
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

  const incompleteSteps = SETUP_STEPS.filter((s) => !isCompleted(progress, s.step));
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

      {/* Steps */}
      {incompleteSteps.length > 0 && (
        <div className="px-3 pb-4 space-y-1">
          {incompleteSteps.map((step) => {
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
                    {step.step === 1 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{
                          background: "rgba(249,115,22,0.2)",
                          color: "#FB923C",
                          border: "1px solid rgba(249,115,22,0.3)",
                        }}
                      >
                        חובה
                      </span>
                    )}
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

      {/* All done */}
      {incompleteSteps.length === 0 && (
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
