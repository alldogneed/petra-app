"use client";

import { Lock, Crown, Sparkles, ArrowLeft } from "lucide-react";
import { getTierDisplay, type TierKey } from "@/lib/feature-flags";

interface PaywallCardProps {
  title: string;
  description: string;
  requiredTier?: TierKey;
  ctaLabel?: string;
  badgeLabel?: string;
  variant?: "page" | "inline";
}

const TIER_COLORS: Record<TierKey, { bg: string; border: string; badge: string; icon: string }> = {
  free: {
    bg: "from-slate-50 to-slate-100",
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
    icon: "text-slate-400",
  },
  basic: {
    bg: "from-blue-50 to-indigo-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    icon: "text-blue-400",
  },
  pro: {
    bg: "from-violet-50 to-purple-50",
    border: "border-violet-200",
    badge: "bg-violet-100 text-violet-700",
    icon: "text-violet-500",
  },
  groomer: {
    bg: "from-pink-50 to-rose-50",
    border: "border-pink-200",
    badge: "bg-pink-100 text-pink-700",
    icon: "text-pink-500",
  },
  groomer_plus: {
    bg: "from-pink-50 to-fuchsia-50",
    border: "border-fuchsia-200",
    badge: "bg-fuchsia-100 text-fuchsia-700",
    icon: "text-fuchsia-500",
  },
  service_dog: {
    bg: "from-amber-50 to-orange-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon: "text-amber-500",
  },
};

export function PaywallCard({
  title,
  description,
  requiredTier = "pro",
  ctaLabel,
  badgeLabel,
  variant = "page",
}: PaywallCardProps) {
  const display = getTierDisplay(requiredTier);
  const colors = TIER_COLORS[requiredTier];

  const badge = badgeLabel ?? `מסלול ${display.name}`;
  const cta = ctaLabel ?? `שדרג למסלול ${display.name}${display.price > 0 ? ` — ₪${display.price}/חודש` : ""}`;

  if (variant === "inline") {
    return (
      <div
        className={`rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-5 flex items-start gap-4`}
        dir="rtl"
      >
        <div className={`mt-0.5 flex-shrink-0 ${colors.icon}`}>
          <Lock className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
              {badge}
            </span>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6" dir="rtl">
      <div
        className={`w-full max-w-md rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} p-8 text-center shadow-sm`}
      >
        <div className="flex justify-center mb-5">
          <div className={`w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center ${colors.icon}`}>
            <Crown className="w-8 h-8" />
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold ${colors.badge}`}>
            <Sparkles className="w-3 h-3" />
            {badge}
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-3">{title}</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">{description}</p>

        <a
          href="mailto:support@petra-app.com?subject=שדרוג מסלול"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          {cta}
          <ArrowLeft className="w-4 h-4" />
        </a>

        {display.price > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            ₪{display.price} לחודש · ביטול בכל עת
          </p>
        )}
      </div>
    </div>
  );
}
