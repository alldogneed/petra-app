"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2, Calendar, Users, BarChart2 } from "lucide-react";

interface StepCompletionProps {
  onComplete: () => void;
}

const NEXT_STEPS = [
  {
    id: "customers",
    icon: Users,
    color: "#3B82F6",
    bg: "#EFF6FF",
    href: "/customers",
  },
  {
    id: "calendar",
    icon: Calendar,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    href: "/calendar",
  },
  {
    id: "dashboard",
    icon: BarChart2,
    color: "#10B981",
    bg: "#ECFDF5",
    href: "/dashboard",
  },
];

export default function StepCompletion({ onComplete }: StepCompletionProps) {
  const t = useTranslations("onboarding.stepCompletion");
  return (
    <div className="space-y-8 text-center animate-fade-in">
      {/* Success icon */}
      <div className="flex justify-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)" }}
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-petra-text">
          {t("title")}
        </h1>
        <p className="text-petra-muted max-w-sm mx-auto">
          {t("subtitle")}
        </p>
      </div>

      {/* Next steps */}
      <div className="grid grid-cols-3 gap-3 text-start">
        {NEXT_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.href}
              className="p-4 rounded-xl border border-slate-100 space-y-2"
              style={{ background: step.bg }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${step.color}20` }}
              >
                <Icon className="w-4 h-4" style={{ color: step.color }} />
              </div>
              <p className="text-sm font-semibold text-petra-text">{t(`nextSteps.${step.id}.title`)}</p>
              <p className="text-xs text-petra-muted leading-snug">{t(`nextSteps.${step.id}.desc`)}</p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onComplete}
        className="btn-primary w-full justify-center py-3.5 text-base"
        style={{
          background: "linear-gradient(135deg, #F97316, #FB923C)",
        }}
      >
        {t("start")}
      </button>
    </div>
  );
}
