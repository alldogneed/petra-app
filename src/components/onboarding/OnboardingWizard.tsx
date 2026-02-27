"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import StepWelcomeProfile from "./StepWelcomeProfile";
import StepBusinessDetails from "./StepBusinessDetails";
import StepFirstService from "./StepFirstService";
import StepFirstClient from "./StepFirstClient";
import StepCompletion from "./StepCompletion";

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: "היכרות", emoji: "👋" },
  { id: 1, label: "פרטי עסק", emoji: "🏢" },
  { id: 2, label: "שירות", emoji: "🏷️" },
  { id: 3, label: "לקוח", emoji: "👤" },
  { id: 4, label: "סיום", emoji: "🎉" },
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full mb-8">
      {/* Mobile: text only */}
      <p className="sm:hidden text-center text-sm text-petra-muted mb-4">
        שלב {currentStep + 1} מתוך {STEPS.length}:{" "}
        <span className="font-bold" style={{ color: "#F97316" }}>
          {STEPS[currentStep]?.label}
        </span>
      </p>

      {/* Desktop: full stepper */}
      <div className="hidden sm:flex items-center justify-center gap-0">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;

          return (
            <div key={step.id} className="flex items-center">
              {/* Circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300"
                  style={
                    isCompleted
                      ? { background: "#10B981", color: "#fff" }
                      : isActive
                      ? {
                          background: "linear-gradient(135deg, #F97316, #FB923C)",
                          color: "#fff",
                          boxShadow: "0 0 0 4px rgba(249,115,22,0.15)",
                        }
                      : { background: "#F1F5F9", color: "#94A3B8" }
                  }
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{step.emoji}</span>
                  )}
                </div>
                <span
                  className="text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    color: isActive
                      ? "#F97316"
                      : isCompleted
                      ? "#0F172A"
                      : "#94A3B8",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className="w-12 lg:w-20 h-[2px] mb-5 mx-1 rounded-full transition-all duration-500"
                  style={{
                    background: isCompleted
                      ? "linear-gradient(90deg, #10B981, #34D399)"
                      : "#E2E8F0",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar (mobile) */}
      <div className="sm:hidden h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(currentStep / (STEPS.length - 1)) * 100}%`,
            background: "linear-gradient(90deg, #F97316, #FB923C)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<number>(0);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding");
      if (!res.ok) throw new Error("Failed to fetch onboarding state");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.progress) {
      if (data.progress.completedAt) {
        router.push("/dashboard");
      } else {
        setCurrentStep(data.progress.currentStep);
      }
    }
  }, [data, router]);

  const updateProgress = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update progress");
      return res.json();
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["onboarding"], newData);
    },
  });

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: "#F97316", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNext = async (stepData: any = {}) => {
    const nextStep = currentStep + 1;
    await updateProgress.mutateAsync({ ...stepData, currentStep: nextStep });
    setCurrentStep(nextStep);
  };

  const handleSkip = async () => {
    const nextStep = currentStep + 1;
    await updateProgress.mutateAsync({ skipped: true, currentStep: nextStep });
    setCurrentStep(nextStep);
  };

  const handleComplete = async () => {
    await updateProgress.mutateAsync({ currentStep: 4 });
    router.push("/dashboard");
  };

  // ─── Step rendering ────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepWelcomeProfile
            initialData={data?.profile}
            onNext={handleNext}
            isPending={updateProgress.isPending}
          />
        );
      case 1:
        return (
          <StepBusinessDetails
            onNext={handleNext}
            isPending={updateProgress.isPending}
          />
        );
      case 2:
        return (
          <StepFirstService
            onNext={handleNext}
            onSkip={handleSkip}
            isPending={updateProgress.isPending}
          />
        );
      case 3:
        return (
          <StepFirstClient
            onNext={handleNext}
            onSkip={handleSkip}
            isPending={updateProgress.isPending}
            businessId={data?.progress?.businessId}
          />
        );
      case 4:
        return <StepCompletion onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <StepIndicator currentStep={currentStep} />

      {/* Card */}
      <div
        className="bg-white rounded-2xl border border-slate-100 p-8 md:p-10"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
      >
        {renderStep()}
      </div>

      {/* Footer hint */}
      <p className="text-center text-xs text-petra-muted mt-6">
        ניתן לשנות את כל ההגדרות בהמשך מדף ההגדרות
      </p>
    </div>
  );
}
