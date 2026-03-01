"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";
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

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ModalProgressBar({ currentStep }: { currentStep: number }) {
  const pct = Math.round((currentStep / (STEPS.length - 1)) * 100);
  return (
    <div className="w-full mb-6">
      {/* Step labels (desktop) */}
      <div className="hidden sm:flex items-center justify-center gap-0 mb-4">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300"
                  style={
                    isCompleted
                      ? { background: "#10B981", color: "#fff" }
                      : isActive
                      ? {
                          background: "linear-gradient(135deg, #F97316, #FB923C)",
                          color: "#fff",
                          boxShadow: "0 0 0 3px rgba(249,115,22,0.15)",
                        }
                      : { background: "#F1F5F9", color: "#94A3B8" }
                  }
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span>{step.emoji}</span>
                  )}
                </div>
                <span
                  className="text-[10px] font-medium whitespace-nowrap transition-colors"
                  style={{
                    color: isActive ? "#F97316" : isCompleted ? "#0F172A" : "#94A3B8",
                  }}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="w-8 lg:w-14 h-[2px] mb-4 mx-1 rounded-full transition-all duration-500"
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

      {/* Mobile: text + bar */}
      <div className="sm:hidden">
        <p className="text-center text-xs text-petra-muted mb-2">
          שלב {currentStep + 1} מתוך {STEPS.length}:{" "}
          <span className="font-bold" style={{ color: "#F97316" }}>
            {STEPS[currentStep]?.label}
          </span>
        </p>
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #F97316, #FB923C)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Modal Wizard ─────────────────────────────────────────────────────────────

interface OnboardingWizardModalProps {
  onClose: () => void;
}

export default function OnboardingWizardModal({ onClose }: OnboardingWizardModalProps) {
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
        // Already completed — close modal
        onClose();
      } else if (data.progress.currentStep > 0) {
        setCurrentStep(data.progress.currentStep);
      }
    }
  }, [data, onClose]);

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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

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

  const handleComplete = useCallback(async () => {
    await updateProgress.mutateAsync({ currentStep: 4 });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    onClose();
    router.push("/dashboard");
  }, [updateProgress, queryClient, onClose, router]);

  // ─── Prevent background scroll ─────────────────────────────────────────────

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-backdrop" onClick={onClose} />
        <div className="modal-content max-w-2xl mx-4 p-8 flex items-center justify-center min-h-[300px]">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: "#F97316", borderTopColor: "transparent" }}
          />
        </div>
      </div>
    );
  }

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
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={currentStep === 4 ? onClose : undefined}
        style={{ cursor: currentStep === 4 ? "pointer" : "default" }}
      />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl overflow-hidden animate-scale-in"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.06) 0%, rgba(251,146,60,0.03) 100%)",
            borderBottom: "1px solid rgba(249,115,22,0.1)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-petra-text">הגדרת חשבון ראשונית</h2>
              <p className="text-xs text-petra-muted mt-0.5">ניתן לשנות הכל בהמשך מדף ההגדרות</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-colors"
              title="סגור"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ModalProgressBar currentStep={currentStep} />
        </div>

        {/* Step content */}
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
