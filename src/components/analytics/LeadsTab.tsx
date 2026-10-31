"use client";

import Link from "next/link";
import { Target, AlertCircle, Coins, Share2, FileText, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import type { AnalyticsData } from "@/lib/analytics-types";
import { cn } from "@/lib/utils";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { TRAFFIC_SOURCE_LABELS, formatMonthKey } from "@/lib/lead-attribution";
import { formatIls } from "@/lib/lead-deal-value";
import { ReportCard, EmptyState, BarList, MiniStat, fmtRate } from "./ReportBlocks";

const LEAD_SOURCE_LABELS: Record<string, string> = Object.fromEntries(LEAD_SOURCES.map((s) => [s.id, s.label]));
const LOST_REASON_LABELS: Record<string, string> = Object.fromEntries(LOST_REASON_CODES.map((r) => [r.id, r.label]));

export function LeadsTab({ data }: { data: AnalyticsData }) {
  const t = useTranslations("analytics.leadsTab");
  const { locale } = useBusinessLocale();
  const bySource = data.leadsBySource ?? [];
  const showWonValue = bySource.some((s) => s.wonValue != null);
  const totals = bySource.reduce(
    (acc, s) => ({ total: acc.total + s.total, open: acc.open + s.open }),
    { total: 0, open: 0 }
  );
  const lostReasons = data.lostReasons ?? [];
  const sales = data.leadSales;
  const attribution = data.leadAttribution;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 flex-1 min-w-0">
          <MiniStat label={t("activeNow")} value={data.leads.active} tone="blue" />
          <MiniStat label={t("newInPeriod")} value={data.leadsBySource ? totals.total : "—"} sub={data.leadsBySource ? t("stillOpen", { count: totals.open }) : undefined} />
          <MiniStat label={t("lostInPeriod")} value={data.leads.lostThisPeriod} tone="red" />
        </div>
        <Link
          href="/leads?view=reports"
          className="btn-secondary flex items-center justify-center gap-1.5 w-full sm:w-auto self-center"
        >
          <FileText className="w-4 h-4" />
          {t("fullSalesReports")}
          <ArrowLeft className="w-3.5 h-3.5 ltr:-scale-x-100" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportCard
          className="lg:col-span-2"
          title={t("bySource")}
          subtitle={t("bySourceSubtitle")}
          icon={<Target className="w-4 h-4 text-brand-500" />}
        >
          {bySource.length === 0 ? (
            <EmptyState text={t("noNewLeads")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1.5 pe-2">{t("cols.source")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("cols.total")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("cols.won")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("cols.lost")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("cols.open")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("cols.conversion")}</th>
                    {showWonValue && <th className="font-medium py-1.5 ps-2 text-center">{t("cols.wonValue")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((s) => (
                    <tr key={s.source} className="border-t border-slate-100">
                      <td className="py-1.5 pe-2 font-medium text-petra-text whitespace-nowrap">{LEAD_SOURCE_LABELS[s.source] ?? s.source}</td>
                      <td className="py-1.5 px-2 text-center tabular-nums font-semibold">{s.total}</td>
                      <td className="py-1.5 px-2 text-center tabular-nums text-emerald-600">{s.won}</td>
                      <td className="py-1.5 px-2 text-center tabular-nums text-red-500">{s.lost}</td>
                      <td className="py-1.5 px-2 text-center tabular-nums text-petra-muted">{s.open}</td>
                      <td className={cn("py-1.5 px-2 text-center tabular-nums", s.conversionRate == null && "text-slate-300")}>
                        {fmtRate(s.conversionRate)}
                      </td>
                      {showWonValue && (
                        <td className="py-1.5 ps-2 text-center tabular-nums whitespace-nowrap">
                          {s.wonValue ? formatIls(s.wonValue) : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        <ReportCard title={t("lostReasons")} icon={<AlertCircle className="w-4 h-4 text-red-400" />}>
          {lostReasons.length === 0 ? (
            <EmptyState text={t("noLostLeads")} />
          ) : (
            <BarList
              barClassName="bg-red-300"
              items={lostReasons.map((r) => ({ key: r.code, label: LOST_REASON_LABELS[r.code] ?? r.code, value: r.count, display: r.count }))}
            />
          )}
        </ReportCard>
      </div>

      {/* Lead sales — deal value of leads won in the period + orders since closing (rule #28: not revenue) */}
      {sales && (
        <ReportCard
          title={t("sales.title")}
          icon={<Coins className="w-4 h-4 text-emerald-600" />}
          subtitle={
            <>{t("sales.subtitle")}</>
          }
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MiniStat
              label={t("sales.dealValue")}
              value={formatIls(sales.dealValueTotal)}
              sub={t("sales.withValueOf", { withValue: sales.withValueCount, won: sales.wonCount })}
              tone="emerald"
            />
            <MiniStat label={t("sales.ordersSince")} value={formatIls(sales.ordersTotal)} sub={t("sales.ordersCount", { count: sales.ordersCount })} />
            <MiniStat label={t("sales.total")} value={formatIls(sales.total)} sub={t("sales.avgDeal", { amount: formatIls(sales.avgDealValue) })} tone="brand" />
            <MiniStat
              label={t("sales.pipeline")}
              value={formatIls(sales.pipelineValue)}
              sub={t("sales.pipelineWithValue", { count: sales.pipelineWithValueCount })}
              tone="amber"
            />
          </div>
          {sales.rows.length === 0 ? (
            <EmptyState text={t("sales.noWon")} className="h-20" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1.5 pe-2">{t("sales.cols.lead")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("sales.cols.wonAt")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("sales.cols.dealValue")}</th>
                    <th className="font-medium py-1.5 px-2 text-center">{t("sales.cols.ordersSince")}</th>
                    <th className="font-semibold py-1.5 ps-2 text-center">{t("cols.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.rows.map((r) => (
                    <tr key={r.leadId} className="border-t border-slate-100">
                      <td className="py-1.5 pe-2 font-medium text-petra-text whitespace-nowrap">
                        {r.customerId ? (
                          <Link href={`/customers/${r.customerId}`} className="hover:text-brand-600 hover:underline">
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-center text-petra-muted whitespace-nowrap">{new Date(r.wonAt).toLocaleDateString(locale)}</td>
                      <td className={cn("py-1.5 px-2 text-center tabular-nums", r.dealValue == null ? "text-slate-300" : "text-emerald-700")}>
                        {r.dealValue == null ? "—" : formatIls(r.dealValue)}
                      </td>
                      <td className={cn("py-1.5 px-2 text-center tabular-nums whitespace-nowrap", r.ordersCount === 0 ? "text-slate-300" : "text-petra-text")}>
                        {r.ordersCount === 0 ? "—" : `${formatIls(r.ordersTotal)} (${r.ordersCount})`}
                      </td>
                      <td className="py-1.5 ps-2 text-center font-semibold tabular-nums">{formatIls(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sales.wonCount > sales.rows.length && (
                <p className="text-[11px] text-petra-muted mt-2">
                  {t("sales.showingLatest", { shown: sales.rows.length, total: sales.wonCount })}
                </p>
              )}
            </div>
          )}
        </ReportCard>
      )}

      {/* Traffic attribution — last 12 months (independent of the selected period) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard
          title={t("attribution.byTrafficSource")}
          icon={<Share2 className="w-4 h-4 text-brand-500" />}
          subtitle={t("attribution.byTrafficSourceSubtitle")}
        >
          {!attribution || attribution.bySourceByMonth.length === 0 ? (
            <EmptyState text={t("attribution.noTrafficSource")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1 pe-2 sticky start-0 bg-white">{t("cols.source")}</th>
                    {attribution.months.map((m) => (
                      <th key={m} className="font-medium py-1 px-1.5 text-center whitespace-nowrap">
                        {formatMonthKey(m)}
                      </th>
                    ))}
                    <th className="font-semibold py-1 ps-2 text-center">{t("cols.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.bySourceByMonth.map((row) => (
                    <tr key={row.source} className="border-t border-slate-100">
                      <td className="py-1 pe-2 font-medium text-petra-text whitespace-nowrap sticky start-0 bg-white">
                        {TRAFFIC_SOURCE_LABELS[row.source] ?? row.source}
                      </td>
                      {row.counts.map((c, i) => (
                        <td key={i} className={cn("py-1 px-1.5 text-center tabular-nums", c === 0 ? "text-slate-300" : "text-petra-text")}>
                          {c}
                        </td>
                      ))}
                      <td className="py-1 ps-2 text-center font-semibold tabular-nums">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        <ReportCard
          title={t("attribution.byLandingPage")}
          icon={<Target className="w-4 h-4 text-brand-500" />}
          subtitle={t("attribution.byLandingPageSubtitle")}
        >
          {!attribution || attribution.byLandingPage.length === 0 ? (
            <EmptyState text={t("attribution.noLandingPage")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs table-fixed">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1 pe-2">{t("attribution.cols.page")}</th>
                    <th className="font-medium py-1 px-2 text-center w-16">{t("attribution.cols.leads")}</th>
                    <th className="font-medium py-1 px-2 text-center w-16">{t("cols.won")}</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.byLandingPage.map((row) => (
                    <tr key={row.page} className="border-t border-slate-100">
                      <td className="py-1 pe-2 text-petra-text truncate text-start" dir="ltr" title={row.page}>
                        {row.page}
                      </td>
                      <td className="py-1 px-2 text-center tabular-nums font-medium">{row.count}</td>
                      <td className="py-1 px-2 text-center tabular-nums text-emerald-600">{row.won}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
