"use client";

import { CheckCircle2, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

interface CompletionScreenProps {
  onContinue: () => void;
}

export function CompletionScreen({ onContinue }: CompletionScreenProps) {
  const t = useTranslations("onboarding.completionScreen");
  const checklist = [
    t("checklist.customerAdded"),
    t("checklist.serviceSet"),
    t("checklist.reminderEnabled"),
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-petra-bg">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"
          style={{
            background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
            boxShadow: "0 8px 32px rgba(16,185,129,0.3)",
          }}
        >
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-petra-text mb-6">
          {t("title")}
        </h1>

        {/* Checklist */}
        <div className="space-y-3 mb-8 text-start max-w-xs mx-auto">
          {checklist.map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-800">
                {item}
              </span>
            </div>
          ))}
        </div>

        {/* Human line */}
        <p className="text-sm text-petra-muted mb-8 leading-relaxed max-w-xs mx-auto">
          {t("humanLine1")}
          <br />
          {t("humanLine2")}
        </p>

        {/* CTA */}
        <button
          onClick={onContinue}
          className="btn-primary inline-flex items-center gap-2 text-base py-3 px-8"
        >
          {t("continueToSettings")}
          <ArrowLeft className="w-4 h-4 ltr:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}
