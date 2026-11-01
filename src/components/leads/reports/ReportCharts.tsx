"use client";

import type { ReactNode } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell, Legend,
} from "recharts";
import { AlertTriangle, Hourglass, Target, Timer, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { SalesReport } from "@/lib/analytics-types";
import { formatIls } from "@/lib/lead-deal-value";
import { agingBucketLabel, monthLabel, responseBucketLabel } from "./format";

export function ReportCard({
  title,
  icon,
  hint,
  className,
  children,
}: {
  title: string;
  icon?: ReactNode;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 p-4 sm:p-5 min-w-0", className)}>
      <h3 className="font-semibold text-petra-text text-sm flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {hint && <p className="text-xs text-petra-muted mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

const axisTick = { fontSize: 11, fill: "#94a3b8" };

// ─── Monthly trend ────────────────────────────────────────────────────────────

export function MonthlyTrendChart({ report }: { report: SalesReport }) {
  const t = useTranslations("leads.reportCharts");
  const tl = useTranslations("leads");
  const wonValueName = t("monthly.wonValue");
  const data = report.monthly.map((m) => ({ ...m, label: monthLabel(m.month, tl) }));
  const showValue = report.canSeeMoney && report.monthly.some((m) => (m.wonValue ?? 0) > 0);
  if (data.length === 0) return null;

  return (
    <ReportCard
      title={t("monthly.title")}
      icon={<TrendingUp className="w-4 h-4 text-brand-500" />}
      hint={t("monthly.hint")}
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={axisTick} />
          <YAxis yAxisId="count" tick={axisTick} allowDecimals={false} />
          {showValue && <YAxis yAxisId="value" orientation="right" tick={axisTick} width={60} />}
          <Tooltip
            formatter={(value, name) =>
              name === wonValueName ? [formatIls(Number(value ?? 0)), name] : [value ?? 0, name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="count" type="monotone" dataKey="created" name={t("monthly.created")} stroke="#6366F1" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="count" type="monotone" dataKey="won" name={t("monthly.won")} stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="count" type="monotone" dataKey="lost" name={t("monthly.lost")} stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
          {showValue && (
            <Line
              yAxisId="value"
              type="monotone"
              dataKey="wonValue"
              name={wonValueName}
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

export function FunnelChart({ report }: { report: SalesReport }) {
  const t = useTranslations("leads.reportCharts");
  const { funnel } = report;
  if (funnel.length === 0) return null;
  const max = Math.max(...funnel.map((s) => s.reached), 1);

  return (
    <ReportCard
      title={t("funnel.title")}
      icon={<Target className="w-4 h-4 text-violet-500" />}
      hint={t("funnel.hint")}
    >
      <div className="space-y-2.5">
        {funnel.map((s, i) => {
          const width = Math.round((s.reached / max) * 100);
          return (
            <div key={s.stageId} className="space-y-1">
              {i > 0 && (
                <p className="text-[11px] text-petra-muted ps-1">
                  {s.stepConversion == null ? t("funnel.continuedNone") : t("funnel.continued", { pct: String(s.stepConversion) })}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-petra-text truncate">{s.name}</span>
                <span className="flex-shrink-0 text-petra-muted">
                  {t.rich("funnel.reachedNow", {
                    reached: String(s.reached),
                    current: String(s.current),
                    b: (c) => <strong className="text-petra-text">{c}</strong>,
                  })}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full transition-all"
                  style={{ width: `${s.reached > 0 ? Math.max(width, 4) : 0}%`, backgroundColor: s.color || "#6366F1" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ReportCard>
  );
}

// ─── Response time distribution ───────────────────────────────────────────────

export function ResponseTimeChart({ report }: { report: SalesReport }) {
  const t = useTranslations("leads.reportCharts");
  const tl = useTranslations("leads");
  const data = report.responseTime.map((b) => ({ ...b, label: responseBucketLabel(b.bucket, tl) }));
  if (data.every((d) => d.count === 0)) return null;

  return (
    <ReportCard
      title={t("responseTime.title")}
      icon={<Timer className="w-4 h-4 text-sky-600" />}
      hint={t("responseTime.hint")}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} />
          <YAxis tick={axisTick} allowDecimals={false} />
          <Tooltip formatter={(value) => [t("responseTime.leadsCount", { count: String(value ?? 0) }), ""]} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={d.bucket === "none" ? "#EF4444" : d.bucket === "gt3d" ? "#F59E0B" : "#3B82F6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportCard>
  );
}

// ─── Aging of open leads ──────────────────────────────────────────────────────

export function AgingChart({ report }: { report: SalesReport }) {
  const t = useTranslations("leads.reportCharts");
  const tl = useTranslations("leads");
  const data = report.aging.map((b) => ({ ...b, label: agingBucketLabel(b.bucket, tl) }));
  if (data.every((d) => d.count === 0)) return null;
  const showValue = report.canSeeMoney && data.some((d) => (d.value ?? 0) > 0);

  return (
    <ReportCard
      title={t("aging.title")}
      icon={<Hourglass className="w-4 h-4 text-amber-500" />}
      hint={t("aging.hint")}
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} />
          <YAxis tick={axisTick} allowDecimals={false} />
          <Tooltip
            formatter={(value, _name, item) => {
              const v = (item?.payload as { value?: number | null } | undefined)?.value;
              return [`${t("aging.leadsCount", { count: String(value ?? 0) })}${showValue && v ? ` · ${formatIls(v)}` : ""}`, ""];
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.bucket} fill={["#22C55E", "#84CC16", "#F59E0B", "#F97316", "#EF4444"][i] ?? "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {showValue && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
          {data.map((d) => (
            <div key={d.bucket} className="rounded-lg bg-slate-50 px-2 py-1.5 min-w-0">
              <p className="text-petra-muted truncate">{d.label}</p>
              <p className="font-semibold text-petra-text truncate">{d.value ? formatIls(d.value) : "—"}</p>
            </div>
          ))}
        </div>
      )}
    </ReportCard>
  );
}

// ─── Stale leads per stage ────────────────────────────────────────────────────

const STALE_DAYS = 14;

export function StaleTable({ report }: { report: SalesReport }) {
  const t = useTranslations("leads.reportCharts");
  const rows = report.stale.filter((s) => s.count > 0);
  if (rows.length === 0) return null;

  return (
    <ReportCard
      title={t("stale.title")}
      icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
      hint={t("stale.hint", { days: STALE_DAYS })}
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-petra-muted border-b border-slate-100">
              <th className="text-start font-medium py-2 px-1">{t("stale.colStage")}</th>
              <th className="text-start font-medium py-2 px-1">{t("stale.colLeads")}</th>
              <th className="text-start font-medium py-2 px-1 whitespace-nowrap">{t("stale.colOldest")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.stageId} className="border-b border-slate-50 last:border-0">
                <td className="py-2 px-1">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-petra-text">{s.name}</span>
                  </span>
                </td>
                <td className="py-2 px-1 font-semibold text-petra-text">{s.count}</td>
                <td className="py-2 px-1 whitespace-nowrap">
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      s.oldestDays > STALE_DAYS ? "bg-red-50 text-red-600" : "bg-slate-100 text-petra-muted"
                    )}
                  >
                    {t("stale.days", { days: String(s.oldestDays) })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}
