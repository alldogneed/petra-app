"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StepWelcomeProfileProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNext: (data: any) => void;
  isPending: boolean;
}

const BUSINESS_TYPES = [
  { value: "מאלף כלבים", label: "מאלף / מאלפת כלבים", emoji: "🐕" },
  { value: "פנסיון", label: "פנסיון לכלבים", emoji: "🏠" },
  { value: "מספרה", label: "מספרה לחיות מחמד", emoji: "✂️" },
  { value: "משולב", label: "משולב (אילוף, פנסיון, מספרה)", emoji: "🌟" },
];

const CLIENT_RANGES = ["עד 20", "20-50", "50+"];

const PRIMARY_GOALS = [
  { value: "סדר ביומן", label: "לעשות סדר ביומן הפגישות" },
  { value: "ניהול לקוחות", label: "לנהל טוב יותר לקוחות וכלבים" },
  { value: "לידים ומכירות", label: "מעקב אחרי לידים ומכירות" },
  { value: "תזכורות אוטומטיות", label: "שליחת תזכורות אוטומטיות (וואטסאפ)" },
  { value: "אחר", label: "אחר" },
];

export default function StepWelcomeProfile({
  initialData,
  onNext,
  isPending,
}: StepWelcomeProfileProps) {
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
        <h1 className="text-2xl font-bold text-petra-text">ברוכים הבאים לפטרה!</h1>
        <p className="text-petra-muted">
          כדי שנוכל להתאים את המערכת לצרכים שלך, ספר לנו קצת על העסק
        </p>
      </div>

      {/* Business type */}
      <div className="space-y-3">
        <label className="label">מה סוג העסק שלך?</label>
        <div className="grid grid-cols-2 gap-3">
          {BUSINESS_TYPES.map((bt) => (
            <button
              key={bt.value}
              onClick={() => setBusinessType(bt.value)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 text-right transition-all duration-200",
                businessType === bt.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 hover:border-brand-200 text-petra-text"
              )}
            >
              <span className="text-2xl flex-shrink-0">{bt.emoji}</span>
              <span className="text-sm font-medium leading-snug">{bt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Client range */}
      <div className="space-y-3">
        <label className="label">כמה לקוחות פעילים יש לך בערך?</label>
        <div className="grid grid-cols-3 gap-3">
          {CLIENT_RANGES.map((range) => (
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
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Primary goal */}
      <div className="space-y-3">
        <label className="label">מה המטרה העיקרית שלך במערכת?</label>
        <div className="space-y-2">
          {PRIMARY_GOALS.map((goal) => (
            <button
              key={goal.value}
              onClick={() => setPrimaryGoal(goal.value)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-right transition-all duration-200",
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
              <span className="text-sm font-medium">{goal.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={!isComplete || isPending}
        className="btn-primary w-full justify-center py-3 text-base"
      >
        {isPending ? "שומר..." : "המשך לשלב הבא ←"}
      </button>
    </div>
  );
}
