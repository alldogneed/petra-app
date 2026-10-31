"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";

// Option values are stored data (OnboardingProfile) — only the labels are translated.
const QUESTIONS = [
  {
    id: "businessType",
    options: [
      { value: "מאלף כלבים", key: "trainer" }, // i18n-ok
      { value: "פנסיון", key: "boarding" }, // i18n-ok
      { value: "מספרה", key: "grooming" }, // i18n-ok
      { value: "משולב", key: "combined" }, // i18n-ok
    ],
  },
  {
    id: "activeClientsRange",
    options: [
      { value: "עד 20", key: "upTo20" }, // i18n-ok
      { value: "20–50", key: "from20To50" },
      { value: "50+", key: "over50" },
    ],
  },
  {
    id: "primaryGoal",
    options: [
      { value: "סדר ביומן", key: "calendar" }, // i18n-ok
      { value: "ניהול לקוחות", key: "clients" }, // i18n-ok
      { value: "לידים ומכירות", key: "leads" }, // i18n-ok
      { value: "תזכורות אוטומטיות", key: "reminders" }, // i18n-ok
    ],
  },
] as const;

export interface PersonalizationAnswers {
  businessType: string;
  activeClientsRange: string;
  primaryGoal: string;
}

interface PersonalizationScreenProps {
  onComplete: (answers: PersonalizationAnswers) => void;
  onBack: () => void;
  loading?: boolean;
}

export function PersonalizationScreen({
  onComplete,
  onBack,
  loading,
}: PersonalizationScreenProps) {
  const t = useTranslations("onboarding.personalizationScreen");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const question = QUESTIONS[currentQ];
  const selectedValue = answers[question.id] ?? null;
  const isLast = currentQ === QUESTIONS.length - 1;

  function handleSelect(value: string) {
    const newAnswers = { ...answers, [question.id]: value };
    setAnswers(newAnswers);

    if (isLast) {
      onComplete(newAnswers as unknown as PersonalizationAnswers);
    } else {
      // Auto-advance after a short delay for UX
      setTimeout(() => setCurrentQ((prev) => prev + 1), 200);
    }
  }

  function handleBack() {
    if (currentQ > 0) {
      setCurrentQ((prev) => prev - 1);
    } else {
      onBack();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-petra-bg">
      <div className="w-full max-w-md animate-fade-in">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === currentQ ? 32 : 12,
                background:
                  i <= currentQ
                    ? "linear-gradient(135deg, #F97316, #FB923C)"
                    : "#E2E8F0",
              }}
            />
          ))}
        </div>

        {/* Question */}
        <div className="text-center mb-8" key={currentQ}>
          <p className="text-xs font-medium text-brand-500 mb-2">
            {t("questionOf", { current: currentQ + 1, total: QUESTIONS.length })}
          </p>
          <h2 className="text-xl font-bold text-petra-text">
            {t(`questions.${question.id}.title`)}
          </h2>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8" key={`opts-${currentQ}`}>
          {question.options.map((option) => {
            const isSelected = selectedValue === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                disabled={loading}
                className="w-full text-start px-5 py-4 rounded-2xl border-2 transition-all duration-200 text-sm font-medium disabled:opacity-50"
                style={{
                  borderColor: isSelected ? "#F97316" : "#E2E8F0",
                  background: isSelected ? "#FFF7ED" : "#FFFFFF",
                  color: isSelected ? "#EA580C" : "#0F172A",
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(249,115,22,0.1)"
                    : undefined,
                }}
              >
                {t(`questions.${question.id}.options.${option.key}`)}
              </button>
            );
          })}
        </div>

        {/* Back button */}
        <div className="text-center">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1 text-sm text-petra-muted hover:text-petra-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4 rotate-180 ltr:-scale-x-100" />
            {t("back")}
          </button>
        </div>
      </div>
    </div>
  );
}
