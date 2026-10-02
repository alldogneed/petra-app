"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Globe, Megaphone, UserCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadSourceRow, SalesReport } from "@/lib/analytics-types";
import { formatIls } from "@/lib/lead-deal-value";
import { ReportCard } from "./ReportCharts";
import { CHART_COLORS, formatRate, sourceLabel, trafficLabel } from "./format";

function RateBadge({ rate }: { rate: number | null }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
        rate == null
          ? "bg-slate-100 text-petra-muted"
          : rate >= 50
            ? "bg-green-100 text-green-700"
            : rate >= 25
              ? "bg-amber-100 text-amber-700"
              : "bg-red-50 text-red-600"
      )}
    >
      {formatRate(rate)}
    </span>
  );
}

const th = "text-start font-medium py-2 px-2 whitespace-nowrap";
const td = "py-2 px-2 whitespace-nowrap";

function SourceRowsTable({
  rows,
  label,
  showMoney,
  firstColumn,
}: {
  rows: LeadSourceRow[];
  label: (id: string) => string;
  showMoney: boolean;
  firstColumn: string;
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-petra-muted border-b border-slate-100">
            <th className={th}>{firstColumn}</th>
            <th className={th}>{'סה"כ'}</th>
            <th className={th}>נסגרו</th>
            <th className={th}>אבדו</th>
            <th className={th}>פתוחים</th>
            <th className={th}>שיעור סגירה</th>
            {showMoney && <th className={th}>ערך שנסגר</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.source || i} className="border-b border-slate-50 last:border-0">
              <td className={td}>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-petra-text">{label(r.source)}</span>
                </span>
              </td>
              <td className={cn(td, "font-semibold text-petra-text")}>{r.total}</td>
              <td className={cn(td, "text-green-700")}>{r.won}</td>
              <td className={cn(td, "text-red-600")}>{r.lost}</td>
              <td className={cn(td, "text-petra-muted")}>{r.open}</td>
              <td className={td}><RateBadge rate={r.conversionRate} /></td>
              {showMoney && <td className={cn(td, "text-petra-text")}>{r.wonValue ? formatIls(r.wonValue) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourceTables({ report }: { report: SalesReport }) {
  const showMoney = report.canSeeMoney && [...report.bySource, ...report.byTrafficSource].some((r) => (r.wonValue ?? 0) > 0);
  return (
    <>
      {report.bySource.length > 0 && (
        <ReportCard
          title="לפי מקור ליד"
          icon={<Megaphone className="w-4 h-4 text-brand-500" />}
          hint="ערוץ הקליטה שנבחר בליד (גוגל, אינסטגרם, המלצה…)"
        >
          <SourceRowsTable rows={report.bySource} label={sourceLabel} showMoney={showMoney} firstColumn="מקור" />
        </ReportCard>
      )}
      {report.byTrafficSource.length > 0 && (
        <ReportCard
          title="לפי מקור תנועה"
          icon={<Globe className="w-4 h-4 text-sky-600" />}
          hint="מאיפה הגיע המבקר לאתר (UTM / מפנה) — לידים מהאתר"
        >
          <SourceRowsTable rows={report.byTrafficSource} label={trafficLabel} showMoney={showMoney} firstColumn="מקור תנועה" />
        </ReportCard>
      )}
    </>
  );
}

export function LandingPageTable({ report }: { report: SalesReport }) {
  if (report.byLandingPage.length === 0) return null;
  return (
    <ReportCard title="לפי עמוד נחיתה" icon={<FileText className="w-4 h-4 text-violet-500" />}>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm table-fixed min-w-[320px]">
          <thead>
            <tr className="text-xs text-petra-muted border-b border-slate-100">
              <th className={cn(th, "w-1/2")}>עמוד</th>
              <th className={th}>{'סה"כ'}</th>
              <th className={th}>נסגרו</th>
              <th className={th}>שיעור</th>
            </tr>
          </thead>
          <tbody>
            {report.byLandingPage.map((p) => (
              <tr key={p.page} className="border-b border-slate-50 last:border-0">
                <td className="py-2 px-2">
                  <span dir="ltr" className="block truncate text-start text-xs font-mono text-petra-text" title={p.page}>
                    {p.page}
                  </span>
                </td>
                <td className={cn(td, "font-semibold text-petra-text")}>{p.total}</td>
                <td className={cn(td, "text-green-700")}>{p.won}</td>
                <td className={td}><RateBadge rate={p.conversionRate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

export function ClosersTable({ report }: { report: SalesReport }) {
  if (report.byUser.length === 0) return null;
  const showMoney = report.canSeeMoney && report.byUser.some((u) => (u.wonValue ?? 0) > 0);
  return (
    <ReportCard
      title="לפי סוגר"
      icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
      hint="מי העביר את הליד לנסגר / אבד"
    >
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-petra-muted border-b border-slate-100">
              <th className={th}>משתמש</th>
              <th className={th}>נסגרו</th>
              <th className={th}>אבדו</th>
              <th className={th}>שיעור סגירה</th>
              {showMoney && <th className={th}>ערך שנסגר</th>}
            </tr>
          </thead>
          <tbody>
            {report.byUser.map((u) => (
              <tr key={u.userId} className="border-b border-slate-50 last:border-0">
                <td className={cn(td, "text-petra-text")}>{u.userId === "unknown" ? "לא תועד" : u.name}</td>
                <td className={cn(td, "text-green-700 font-semibold")}>{u.won}</td>
                <td className={cn(td, "text-red-600")}>{u.lost}</td>
                <td className={td}><RateBadge rate={u.conversionRate} /></td>
                {showMoney && <td className={cn(td, "text-petra-text")}>{u.wonValue ? formatIls(u.wonValue) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportCard>
  );
}

export function LostReasonsCard({ report }: { report: SalesReport }) {
  const data = report.lostReasons.filter((r) => r.count > 0);
  if (data.length === 0) return null;
  const total = data.reduce((s, r) => s + r.count, 0);

  return (
    <ReportCard title="סיבות אובדן" icon={<XCircle className="w-4 h-4 text-red-500" />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="count" nameKey="label">
              {data.map((r, i) => (
                <Cell key={r.code || i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value ?? 0} לידים`, ""]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 flex flex-col justify-center min-w-0">
          {data.map((r, i) => (
            <div key={r.code || i} className="flex items-center gap-2 text-sm min-w-0">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-petra-text flex-1 truncate">{r.label}</span>
              <span className="font-bold text-petra-text">{r.count}</span>
              <span className="text-xs text-petra-muted">({Math.round((r.count / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </ReportCard>
  );
}
