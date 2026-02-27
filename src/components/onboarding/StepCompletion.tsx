"use client";

import { CheckCircle2, Calendar, Users, BarChart2 } from "lucide-react";

interface StepCompletionProps {
  onComplete: () => void;
}

const NEXT_STEPS = [
  {
    icon: Users,
    color: "#3B82F6",
    bg: "#EFF6FF",
    title: "הוסף לקוחות",
    desc: "ייבא את רשימת הלקוחות שלך",
    href: "/customers",
  },
  {
    icon: Calendar,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    title: "קבע תורים",
    desc: "פתח את היומן ותתחיל לתזמן",
    href: "/calendar",
  },
  {
    icon: BarChart2,
    color: "#10B981",
    bg: "#ECFDF5",
    title: "צפה בדשבורד",
    desc: "ראה את כל הנתונים במקום אחד",
    href: "/dashboard",
  },
];

export default function StepCompletion({ onComplete }: StepCompletionProps) {
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
          ¡ הכל מוכן! 🎉
        </h1>
        <p className="text-petra-muted max-w-sm mx-auto">
          הגדרנו את הבסיס. עכשיו אפשר להתחיל לנהל את העסק בצורה חכמה יותר.
        </p>
      </div>

      {/* Next steps */}
      <div className="grid grid-cols-3 gap-3 text-right">
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
              <p className="text-sm font-semibold text-petra-text">{step.title}</p>
              <p className="text-xs text-petra-muted leading-snug">{step.desc}</p>
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
        בואו נתחיל! 🚀
      </button>
    </div>
  );
}
