"use client";

import Link from "next/link";
import { Target, AlertCircle, Coins, Share2, FileText, ArrowLeft } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics-types";
import { cn } from "@/lib/utils";
import { LEAD_SOURCES, LOST_REASON_CODES } from "@/lib/constants";
import { TRAFFIC_SOURCE_LABELS, formatMonthKey } from "@/lib/lead-attribution";
import { formatIls } from "@/lib/lead-deal-value";
import { ReportCard, EmptyState, BarList, MiniStat, fmtRate } from "./ReportBlocks";

const LEAD_SOURCE_LABELS: Record<string, string> = Object.fromEntries(LEAD_SOURCES.map((s) => [s.id, s.label]));
const LOST_REASON_LABELS: Record<string, string> = Object.fromEntries(LOST_REASON_CODES.map((r) => [r.id, r.label]));

export function LeadsTab({ data }: { data: AnalyticsData }) {
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
          <MiniStat label="לידים פעילים כעת" value={data.leads.active} tone="blue" />
          <MiniStat label="לידים חדשים בתקופה" value={data.leadsBySource ? totals.total : "—"} sub={data.leadsBySource ? `${totals.open} עדיין פתוחים` : undefined} />
          <MiniStat label="לידים שאבדו בתקופה" value={data.leads.lostThisPeriod} tone="red" />
        </div>
        <Link
          href="/leads?view=reports"
          className="btn-secondary flex items-center justify-center gap-1.5 w-full sm:w-auto self-center"
        >
          <FileText className="w-4 h-4" />
          לדוחות המכירות המלאים
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportCard
          className="lg:col-span-2"
          title="לידים לפי מקור"
          subtitle="לידים שנוצרו בתקופה · המרה = נסגרו מתוך (נסגרו + אבדו)"
          icon={<Target className="w-4 h-4 text-brand-500" />}
        >
          {bySource.length === 0 ? (
            <EmptyState text="אין לידים חדשים בתקופה זו" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1.5 pe-2">מקור</th>
                    <th className="font-medium py-1.5 px-2 text-center">סה״כ</th>
                    <th className="font-medium py-1.5 px-2 text-center">נסגרו</th>
                    <th className="font-medium py-1.5 px-2 text-center">אבדו</th>
                    <th className="font-medium py-1.5 px-2 text-center">פתוחים</th>
                    <th className="font-medium py-1.5 px-2 text-center">המרה</th>
                    {showWonValue && <th className="font-medium py-1.5 ps-2 text-center">ערך שנסגר</th>}
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

        <ReportCard title="סיבות אובדן לידים" icon={<AlertCircle className="w-4 h-4 text-red-400" />}>
          {lostReasons.length === 0 ? (
            <EmptyState text="אין לידים שאבדו בתקופה זו" />
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
          title="מכירות מלידים"
          icon={<Coins className="w-4 h-4 text-emerald-600" />}
          subtitle={
            <>
              לידים שנסגרו בתקופה · ערך העסקה שהוזן בכרטיס הליד + הזמנות שהלקוח ביצע מאז הסגירה ועד היום (ללא מבוטלות) · מדד נפרד, לא נכלל ב&quot;הכנסות&quot; · אם פתחת הזמנה על אותה עסקה היא תיספר גם בהזמנות
            </>
          }
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MiniStat
              label="ערך עסקאות שנסגרו"
              value={formatIls(sales.dealValueTotal)}
              sub={`${sales.withValueCount} מתוך ${sales.wonCount} לידים עם ערך`}
              tone="emerald"
            />
            <MiniStat label="הזמנות מאז הסגירה" value={formatIls(sales.ordersTotal)} sub={`${sales.ordersCount} הזמנות`} />
            <MiniStat label="סה״כ מכירות מלידים" value={formatIls(sales.total)} sub={`עסקה ממוצעת ${formatIls(sales.avgDealValue)}`} tone="brand" />
            <MiniStat
              label="ערך בצנרת (לידים פתוחים)"
              value={formatIls(sales.pipelineValue)}
              sub={`${sales.pipelineWithValueCount} לידים עם ערך`}
              tone="amber"
            />
          </div>
          {sales.rows.length === 0 ? (
            <EmptyState text="אין לידים שנסגרו בתקופה זו" className="h-20" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1.5 pe-2">ליד</th>
                    <th className="font-medium py-1.5 px-2 text-center">נסגר</th>
                    <th className="font-medium py-1.5 px-2 text-center">ערך עסקה</th>
                    <th className="font-medium py-1.5 px-2 text-center">הזמנות מאז</th>
                    <th className="font-semibold py-1.5 ps-2 text-center">סה״כ</th>
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
                      <td className="py-1.5 px-2 text-center text-petra-muted whitespace-nowrap">{new Date(r.wonAt).toLocaleDateString("he-IL")}</td>
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
                  מוצגים {sales.rows.length} האחרונים מתוך {sales.wonCount} · הסכומים למעלה כוללים את כולם
                </p>
              )}
            </div>
          )}
        </ReportCard>
      )}

      {/* Traffic attribution — last 12 months (independent of the selected period) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard
          title="לידים לפי מקור תנועה לפי חודש"
          icon={<Share2 className="w-4 h-4 text-brand-500" />}
          subtitle="12 החודשים האחרונים (ללא תלות בטווח שנבחר) · לפי utm / gclid / referrer שהגיעו מהאתר"
        >
          {!attribution || attribution.bySourceByMonth.length === 0 ? (
            <EmptyState text="אין לידים עם מקור תנועה ב-12 החודשים האחרונים" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1 pe-2 sticky start-0 bg-white">מקור</th>
                    {attribution.months.map((m) => (
                      <th key={m} className="font-medium py-1 px-1.5 text-center whitespace-nowrap">
                        {formatMonthKey(m)}
                      </th>
                    ))}
                    <th className="font-semibold py-1 ps-2 text-center">סה״כ</th>
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
          title="לידים לפי עמוד נחיתה"
          icon={<Target className="w-4 h-4 text-brand-500" />}
          subtitle="12 החודשים האחרונים (ללא תלות בטווח שנבחר) · 20 העמודים המובילים"
        >
          {!attribution || attribution.byLandingPage.length === 0 ? (
            <EmptyState text="אין לידים עם עמוד נחיתה ב-12 החודשים האחרונים" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs table-fixed">
                <thead>
                  <tr className="text-petra-muted">
                    <th className="text-start font-medium py-1 pe-2">עמוד</th>
                    <th className="font-medium py-1 px-2 text-center w-16">לידים</th>
                    <th className="font-medium py-1 px-2 text-center w-16">נסגרו</th>
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
