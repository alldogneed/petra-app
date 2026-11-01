"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Clock, Coins, Minus, Target, TrendingUp, Trophy, Users, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalesReport } from "@/lib/analytics-types";
import { formatIls } from "@/lib/lead-deal-value";
import { pctChange } from "@/lib/report-dates";
import { formatDays, formatDuration, formatRate } from "./format";

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  children,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconBg: string;
  children?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-petra-muted">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-petra-text truncate">{value}</p>
      {children && <div className="text-xs text-petra-muted space-y-0.5">{children}</div>}
    </div>
  );
}

/** Arrow + change vs the previous equal-length range. `points` = percentage-point delta (for rates). */
function Change({ current, previous, points }: { current: number | null; previous: number | null; points?: boolean }) {
  const t = useTranslations("leads.reportKpis");
  if (current == null || previous == null) return null;
  let value: number | null;
  let unit: string;
  if (points) {
    value = current - previous;
    unit = t("pointsUnit");
  } else {
    value = pctChange(current, previous);
    unit = "%";
  }
  if (value == null) {
    return <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">{t("new")}</span>;
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-medium",
        value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-petra-muted"
      )}
      dir="ltr"
    >
      <Icon className="w-3 h-3" />
      {Math.abs(value)}
      {unit}
    </span>
  );
}

export function ReportKpis({ report }: { report: SalesReport }) {
  const t = useTranslations("leads.reportKpis");
  const tl = useTranslations("leads");
  const { kpis, previous } = report;
  const showMoney =
    report.canSeeMoney &&
    [kpis.wonValue, kpis.pipelineValue, kpis.forecastValue, kpis.avgDealValue].some((v) => v != null && v > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t("totalLeads")} value={kpis.total} icon={<Users className="w-4 h-4 text-brand-600" />} iconBg="bg-brand-50">
          <p className="flex items-center gap-1 flex-wrap">
            <Change current={kpis.total} previous={previous.total} /> <span>{t("vsPreviousPeriod")}</span>
          </p>
        </KpiCard>

        <KpiCard
          label={t("conversionRate")}
          value={formatRate(kpis.conversionRate)}
          icon={<Trophy className="w-4 h-4 text-green-600" />}
          iconBg="bg-green-50"
        >
          <p>
            {t("wonLostOpen", { won: kpis.won, lost: kpis.lost, open: kpis.open })}
          </p>
          <p className="flex items-center gap-1 flex-wrap">
            <span>{t("rate")}</span>
            <Change current={kpis.conversionRate} previous={previous.conversionRate} points />
            <span>{t("dotWon")}</span>
            <Change current={kpis.won} previous={previous.won} />
          </p>
        </KpiCard>

        <KpiCard
          label={t("firstResponseTime")}
          value={formatDuration(kpis.avgFirstResponseHours, tl)}
          icon={<Timer className="w-4 h-4 text-sky-600" />}
          iconBg="bg-sky-50"
        >
          <p>
            {t("avgMedianResponded", {
              median: formatDuration(kpis.medianFirstResponseHours, tl),
              count: kpis.respondedCount,
            })}
          </p>
          {kpis.unrespondedOpenCount > 0 && (
            <p className="text-red-600 font-medium">{t("unrespondedOpen", { count: kpis.unrespondedOpenCount })}</p>
          )}
        </KpiCard>

        <KpiCard
          label={t("avgTimeToClose")}
          value={formatDays(kpis.avgDaysToClose, tl)}
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          iconBg="bg-amber-50"
        >
          <p>{t("fromCreationToClose")}</p>
        </KpiCard>
      </div>

      {showMoney && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label={t("wonDealsValue")}
            value={kpis.wonValue != null ? formatIls(kpis.wonValue) : "—"}
            icon={<Coins className="w-4 h-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
          >
            <p>
              {t("withValueOfWon", { count: kpis.wonWithValueCount, won: kpis.won })}
            </p>
            <p className="flex items-center gap-1 flex-wrap">
              <Change current={kpis.wonValue} previous={previous.wonValue} /> <span>{t("vsPreviousPeriod")}</span>
            </p>
          </KpiCard>
          <KpiCard
            label={t("avgDeal")}
            value={kpis.avgDealValue != null ? formatIls(kpis.avgDealValue) : "—"}
            icon={<Trophy className="w-4 h-4 text-green-600" />}
            iconBg="bg-green-50"
          >
            <p>{t("ofWonWithValue")}</p>
          </KpiCard>
          <KpiCard
            label={t("pipelineValue")}
            value={kpis.pipelineValue != null ? formatIls(kpis.pipelineValue) : "—"}
            icon={<Target className="w-4 h-4 text-amber-500" />}
            iconBg="bg-amber-50"
          >
            <p>{t("allOpenNow", { count: kpis.pipelineWithValueCount })}</p>
          </KpiCard>
          <KpiCard
            label={t("forecast")}
            value={kpis.forecastValue != null ? formatIls(kpis.forecastValue) : "—"}
            icon={<TrendingUp className="w-4 h-4 text-violet-500" />}
            iconBg="bg-violet-50"
          >
            <p>{t("forecastBasis", { rate: formatRate(kpis.historicalConversionRate) })}</p>
          </KpiCard>
        </div>
      )}
    </div>
  );
}
