"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Shared building blocks for the /analytics ("דוחות") tabs.

export const CHART_COLORS = {
  brand: "#F97316",
  brandLight: "#FDBA74",
  emerald: "#10B981",
  blue: "#3B82F6",
  violet: "#8B5CF6",
  amber: "#F59E0B",
  red: "#EF4444",
  pink: "#EC4899",
  teal: "#14B8A6",
  indigo: "#6366F1",
  slate: "#94A3B8",
} as const;

/** Rates are integers 0–100 or null ("no data"). */
export function fmtRate(rate: number | null | undefined): string {
  return rate == null ? "—" : `${rate}%`;
}

export function fmtMoney(amount: number | null | undefined): string {
  return amount == null ? "—" : formatCurrency(amount);
}

/** "YYYY-MM-DD" → "D/M" without timezone drift. */
export function formatDayLabel(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return `${Number(m[3])}/${Number(m[2])}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

/** Period-over-period change; null = "new" (previous period was 0). */
export function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">חדש</span>;
  if (value === 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-400">
        <Minus className="w-3 h-3" /> 0%
      </span>
    );
  if (value > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-600">
        <ArrowUpRight className="w-3 h-3" />
        {value}%
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-500">
      <ArrowDownRight className="w-3 h-3" />
      {Math.abs(value)}%
    </span>
  );
}

export function KpiCard({
  icon,
  iconClassName,
  label,
  value,
  sub,
  change,
  progress,
  progressClassName = "bg-brand-400",
}: {
  icon: ReactNode;
  /** e.g. "bg-emerald-50 text-emerald-500" */
  iconClassName: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** undefined = no indicator; null = "חדש". */
  change?: number | null;
  /** 0–100, renders a thin progress bar. */
  progress?: number | null;
  progressClassName?: string;
}) {
  return (
    <div className="stat-card min-w-0">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconClassName)}>{icon}</div>
        {change !== undefined && <ChangeIndicator value={change} />}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-petra-text tabular-nums truncate">{value}</div>
      <div className="text-xs text-petra-muted mt-1">{label}</div>
      {sub && <div className="text-[11px] text-petra-muted mt-0.5">{sub}</div>}
      {progress != null && (
        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full", progressClassName)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

export function ReportCard({
  title,
  icon,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card p-4 sm:p-5 min-w-0", className)}>
      <div className={cn("flex items-start justify-between gap-2", subtitle ? "mb-1" : "mb-4")}>
        <h3 className="text-sm font-semibold text-petra-text flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {subtitle && <p className="text-[11px] text-petra-muted mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ text, className }: { text: string; className?: string }) {
  return <div className={cn("flex items-center justify-center h-32 text-sm text-petra-muted text-center", className)}>{text}</div>;
}

/** Small metric tile used inside cards. */
export function MiniStat({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "slate" | "emerald" | "brand" | "amber" | "red" | "blue" | "violet";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50 border-slate-100 text-petra-text",
    emerald: "bg-emerald-50/60 border-emerald-100 text-emerald-700",
    brand: "bg-brand-50/60 border-brand-100 text-brand-700",
    amber: "bg-amber-50/60 border-amber-100 text-amber-700",
    red: "bg-red-50/60 border-red-100 text-red-600",
    blue: "bg-blue-50/60 border-blue-100 text-blue-700",
    violet: "bg-violet-50/60 border-violet-100 text-violet-700",
  };
  return (
    <div className={cn("rounded-xl border p-3 min-w-0", tones[tone])}>
      <p className="text-[11px] text-petra-muted">{label}</p>
      <p className="text-lg sm:text-xl font-bold tabular-nums truncate">{value}</p>
      {sub && <p className="text-[11px] text-petra-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  display: ReactNode;
  href?: string;
  sub?: ReactNode;
}

/** Horizontal bar list — bars scaled to the largest value. */
export function BarList({ items, barClassName = "bg-brand-400", numbered = false }: { items: BarListItem[]; barClassName?: string; numbered?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const width = max > 0 ? Math.round((item.value / max) * 100) : 0;
        return (
          <div key={item.key} className="flex items-center gap-3">
            {numbered && <span className="text-xs font-bold text-petra-muted w-5 text-start flex-shrink-0">{idx + 1}</span>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                {item.href ? (
                  <Link href={item.href} className="font-medium text-petra-text truncate hover:text-brand-600 hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-medium text-petra-text truncate">{item.label}</span>
                )}
                <span className="text-petra-muted flex-shrink-0 tabular-nums">{item.display}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${width}%` }} />
              </div>
              {item.sub && <div className="text-[10px] text-petra-muted mt-0.5">{item.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TooltipPayloadItem {
  color?: string;
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
}

/** Recharts custom tooltip (Hebrew, RTL). Pass `valueFormatter` for money. */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (v: number) => string;
  labelFormatter?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const labelText = label == null ? "" : labelFormatter ? labelFormatter(String(label)) : String(label);
  return (
    <div dir="rtl" className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 text-xs">
      {labelText && <p className="font-semibold text-petra-text mb-1">{labelText}</p>}
      {payload.map((p, i) => {
        const num = typeof p.value === "number" ? p.value : Number(p.value);
        return (
          <p key={i} style={{ color: p.color }} className="tabular-nums">
            {p.name}: {Number.isFinite(num) && valueFormatter ? valueFormatter(num) : p.value}
          </p>
        );
      })}
    </div>
  );
}
