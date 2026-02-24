"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { AnalyticsInsight } from "@/lib/analytics-insights";

interface InsightsBannerProps {
  insights: AnalyticsInsight[];
}

const configs = {
  warning: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    Icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  success: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-800",
    Icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    Icon: Info,
    iconColor: "text-blue-500",
  },
};

export function InsightsBanner({ insights }: InsightsBannerProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-5">
      {insights.map((insight, idx) => {
        const { bg, text, Icon, iconColor } = configs[insight.type];
        return (
          <div
            key={idx}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${bg} ${text}`}
          >
            <Icon size={16} className={`mt-0.5 flex-shrink-0 ${iconColor}`} />
            <span>{insight.message}</span>
          </div>
        );
      })}
    </div>
  );
}
