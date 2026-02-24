"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";

const QUESTIONS = [
  {
    id: "businessType",
    question: "מה סוג העסק שלך?",
    options: ["מאלף כלבים", "פנסיון", "מספרה", "משולב"],
  },
  {
    id: "activeClientsRange",
    question: "כמה לקוחות פעילים יש לך כרגע?",
    options: ["עד 20", "20–50", "50+"],
  },
  {
    id: "primaryGoal",
    question: "מה הכי חשוב לך כרגע?",
    options: [
      "סדר ביומן",
      "ניהול לקוחות",
      "לידים ומכירות",
      "תזכורות אוטומטיות",
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
            שאלה {currentQ + 1} מתוך {QUESTIONS.length}
          </p>
          <h2 className="text-xl font-bold text-petra-text">
            {question.question}
          </h2>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8" key={`opts-${currentQ}`}>
          {question.options.map((option) => {
            const isSelected = selectedValue === option;
            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={loading}
                className="w-full text-right px-5 py-4 rounded-2xl border-2 transition-all duration-200 text-sm font-medium disabled:opacity-50"
                style={{
                  borderColor: isSelected ? "#F97316" : "#E2E8F0",
                  background: isSelected ? "#FFF7ED" : "#FFFFFF",
                  color: isSelected ? "#EA580C" : "#0F172A",
                  boxShadow: isSelected
                    ? "0 0 0 3px rgba(249,115,22,0.1)"
                    : undefined,
                }}
              >
                {option}
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
            <ChevronLeft className="w-4 h-4 rotate-180" />
            חזרה
          </button>
        </div>
      </div>
    </div>
  );
}
