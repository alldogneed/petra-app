"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface StepWelcomeProfileProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNext: (data: any) => void;
  isPending: boolean;
}

// `value` = stored OnboardingProfile data (compared elsewhere) — never translate.
const BUSINESS_TYPES = [
  { value: "מאלף כלבים", labelKey: "trainer", emoji: "🐕" }, // i18n-ok — stored value
  { value: "פנסיון", labelKey: "boarding", emoji: "🏠" }, // i18n-ok — stored value
  { value: "מספרה", labelKey: "grooming", emoji: "✂️" }, // i18n-ok — stored value
  { value: "משולב", labelKey: "combined", emoji: "🌟" }, // i18n-ok — stored value
];

const CLIENT_RANGES: { value: string; labelKey?: string }[] = [
  { value: "עד 20", labelKey: "upTo20" }, // i18n-ok — stored value
  { value: "20-50" },
  { value: "50+" },
];

const PRIMARY_GOALS = [
  { value: "סדר ביומן", labelKey: "calendar" }, // i18n-ok — stored value
  { value: "ניהול לקוחות", labelKey: "clients" }, // i18n-ok — stored value
  { value: "לידים ומכירות", labelKey: "leads" }, // i18n-ok — stored value
  { value: "תזכורות אוטומטיות", labelKey: "reminders" }, // i18n-ok — stored value
  { value: "אחר", labelKey: "other" }, // i18n-ok — stored value
];

export default function StepWelcomeProfile({
  initialData,
  onNext,
  isPending,
}: StepWelcomeProfileProps) {
  const t = useTranslations("onboarding.stepWelcomeProfile");
  const tc = useTranslations("common");
  const [businessType, setBusinessType] = useState(
    initialData?.businessType || ""
  );
  const [activeClientsRange, setActiveClientsRange] = useState(
    initialData?.activeClientsRange || ""
  );
  const [primaryGoal, setPrimaryGoal] = useState(
    initialData?.primaryGoal || ""
  );

  const isComplete = businessType && activeClientsRange && primaryGoal;

  const handleContinue = () => {
    onNext({ businessType, activeClientsRange, primaryGoal });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-4xl mb-3">👋</div>
        <h1 className="text-2xl font-bold text-petra-text">{t("title")}</h1>
        <p className="text-petra-muted">
          {t("subtitle")}
        </p>
      </div>

      {/* Business type */}
      <div className="space-y-3">
        <label className="label">{t("businessTypeLabel")}</label>
        <div className="grid grid-cols-2 gap-3">
          {BUSINESS_TYPES.map((bt) => (
            <button
              key={bt.value}
              onClick={() => setBusinessType(bt.value)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-start transition-all duration-200",
                businessType === bt.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 hover:border-brand-200 text-petra-text"
              )}
            >
              <span className="text-2xl flex-shrink-0">{bt.emoji}</span>
              <span className="text-sm font-medium leading-snug">{t(`businessTypes.${bt.labelKey}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Client range */}
      <div className="space-y-3">
        <label className="label">{t("clientRangeLabel")}</label>
        <div className="grid grid-cols-3 gap-3">
          {CLIENT_RANGES.map(({ value: range, labelKey }) => (
            <button
              key={range}
              onClick={() => setActiveClientsRange(range)}
              className={cn(
                "h-12 rounded-xl border-2 font-medium text-sm transition-all duration-200",
                activeClientsRange === range
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 hover:border-brand-200 text-petra-text"
              )}
            >
              {labelKey ? t(`clientRanges.${labelKey}`) : range}
            </button>
          ))}
        </div>
      </div>

      {/* Primary goal */}
      <div className="space-y-3">
        <label className="label">{t("goalLabel")}</label>
        <div className="space-y-2">
          {PRIMARY_GOALS.map((goal) => (
            <button
              key={goal.value}
              onClick={() => setPrimaryGoal(goal.value)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-start transition-all duration-200",
                primaryGoal === goal.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 hover:border-brand-200 text-petra-text"
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                  primaryGoal === goal.value
                    ? "border-brand-500 bg-brand-500"
                    : "border-slate-300"
                )}
              />
              <span className="text-sm font-medium">{t(`goals.${goal.labelKey}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!isComplete || isPending}
        className="btn-primary w-full justify-center py-3 text-base"
      >
        {isPending ? tc("progress.saving") : t("continue")}
      </button>
    </div>
  );
}
