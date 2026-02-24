"use client";

import { X } from "lucide-react";

interface OnboardingProgressBarProps {
  currentStep: number; // 1-4
  totalSteps: number;
  onExit: () => void;
}

export function OnboardingProgressBar({
  currentStep,
  totalSteps,
  onExit,
}: OnboardingProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-white border-b border-petra-border shadow-sm">
      <div className="flex items-center h-14 px-4 max-w-4xl mx-auto">
        {/* Step indicator */}
        <span className="text-sm font-semibold text-petra-text whitespace-nowrap">
          שלב {currentStep} מתוך {totalSteps}
        </span>

        {/* Progress bar */}
        <div className="flex-1 mx-4 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
            }}
          />
        </div>

        {/* Exit button */}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-petra-muted hover:text-petra-text transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-50"
          title="יציאה מההדרכה"
        >
          <span className="hidden sm:inline">יציאה</span>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
