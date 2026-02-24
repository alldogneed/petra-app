"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: number; // fraction, e.g. 0.15 = +15%
  positiveDirection?: "up" | "down"; // "up" = good when rising, "down" = good when rising means bad
  icon?: React.ReactNode;
  color?: string; // tailwind bg class
  isLoading?: boolean;
  suffix?: string;
}

export function KpiCard({
  label,
  value,
  change,
  positiveDirection = "up",
  icon,
  color = "bg-white",
  isLoading = false,
  suffix,
}: KpiCardProps) {
  const hasChange = change !== undefined && !isNaN(change);
  const isPositive =
    hasChange && (positiveDirection === "up" ? change > 0 : change < 0);
  const isNegative =
    hasChange && (positiveDirection === "up" ? change < 0 : change > 0);

  const changeColor = isPositive
    ? "text-emerald-600"
    : isNegative
    ? "text-red-500"
    : "text-gray-400";

  const ChangIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div
      className={`${color} rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-200`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 mb-1 truncate">{label}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {value}
              {suffix && <span className="text-sm font-normal text-gray-500 mr-1">{suffix}</span>}
            </p>
          )}
          {hasChange && !isLoading && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${changeColor}`}>
              <ChangIcon size={12} />
              <span>
                {change > 0 ? "+" : ""}
                {(change * 100).toFixed(1)}% לעומת הקודם
              </span>
            </div>
          )}
          {!hasChange && !isLoading && (
            <div className="h-4 mt-2" />
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 mr-3 text-gray-400">{icon}</div>
        )}
      </div>
    </div>
  );
}
