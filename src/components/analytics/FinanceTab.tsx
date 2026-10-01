"use client";

import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { CreditCard, Lock, TrendingUp, Users, Wallet, PieChart as PieIcon, Briefcase, AlertCircle } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics-types";
import { formatCurrency } from "@/lib/utils";
import { formatMonthKey } from "@/lib/lead-attribution";
import { ReportCard, EmptyState, BarList, MiniStat, ChartTooltip, CHART_COLORS, fmtMoney } from "./ReportBlocks";

export function FinanceTab({ data }: { data: AnalyticsData }) {
  const f = data.finance;
  if (!f) {
    return (
      <div className="card p-8 text-center">
        <Lock className="w-7 h-7 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-petra-muted">אין הרשאה לנתונים כספיים</p>
      </div>
    );
  }

  const hasMonthly = f.monthly.some((m) => m.revenue > 0 || m.prevYearRevenue > 0);
  const categories = f.byCategory.filter((c) => c.revenue > 0);
  const methods = f.byMethod.filter((m) => m.revenue > 0 || m.count > 0);
  const nvr = f.newVsReturning;
  const nvrTotal = nvr.newCustomers + nvr.returningCustomers;
  const newPct = nvrTotal > 0 ? Math.round((nvr.newCustomers / nvrTotal) * 100) : 0;
  const services = (data.charts.revenueByService ?? []).filter((s) => s.revenue > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="לקוחות משלמים בתקופה" value={f.payingCustomers} tone="blue" />
        <MiniStat label="הכנסה ממוצעת ללקוח משלם" value={fmtMoney(data.retention.avgRevenuePerCustomer)} tone="emerald" />
      </div>

      <ReportCard
        title="הכנסות לפי חודש מול שנה שעברה"
        subtitle="12 החודשים האחרונים · השוואה לאותו חודש בשנה הקודמת"
        icon={<TrendingUp className="w-4 h-4 text-brand-500" />}
      >
        {!hasMonthly ? (
          <EmptyState text="אין הכנסות להצגה" />
        ) : (
          <div dir="ltr" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={f.monthly} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonthKey} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip content={<ChartTooltip valueFormatter={formatCurrency} labelFormatter={formatMonthKey} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="revenue" name="השנה" stroke={CHART_COLORS.brand} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="prevYearRevenue" name="שנה שעברה" stroke={CHART_COLORS.slate} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="הכנסות לפי תחום" icon={<PieIcon className="w-4 h-4 text-brand-500" />}>
          {categories.length === 0 ? (
            <EmptyState text="אין הכנסות בתקופה זו" />
          ) : (
            <BarList
              barClassName="bg-emerald-400"
              items={categories.map((c) => ({ key: c.category, label: c.label, value: c.revenue, display: formatCurrency(c.revenue) }))}
            />
          )}
        </ReportCard>

        <ReportCard title="הכנסות לפי אמצעי תשלום" icon={<Wallet className="w-4 h-4 text-brand-500" />}>
          {methods.length === 0 ? (
            <EmptyState text="אין תשלומים בתקופה זו" />
          ) : (
            <BarList
              barClassName="bg-blue-400"
              items={methods.map((m) => ({
                key: m.method,
                label: m.label,
                value: m.revenue,
                display: `${formatCurrency(m.revenue)} · ${m.count}`,
              }))}
            />
          )}
        </ReportCard>

        <ReportCard title="הכנסות לפי שירות" icon={<Briefcase className="w-4 h-4 text-brand-500" />}>
          {services.length === 0 ? (
            <EmptyState text="אין הכנסות בתקופה זו" />
          ) : (
            <BarList
              barClassName="bg-violet-400"
              items={services.map((s, i) => ({ key: `${s.name}-${i}`, label: s.name, value: s.revenue, display: formatCurrency(s.revenue) }))}
            />
          )}
        </ReportCard>

        <ReportCard title="לקוחות חדשים מול חוזרים" icon={<Users className="w-4 h-4 text-brand-500" />} subtitle="הכנסות בתקופה לפי מועד הצטרפות הלקוח המשלם">
          {nvrTotal === 0 ? (
            <EmptyState text="אין הכנסות בתקופה זו" />
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                <div className="bg-brand-400" style={{ width: `${newPct}%` }} />
                <div className="bg-slate-400" style={{ width: `${100 - newPct}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="לקוחות חדשים" value={formatCurrency(nvr.newCustomers)} sub={`${newPct}%`} tone="brand" />
                <MiniStat label="לקוחות חוזרים" value={formatCurrency(nvr.returningCustomers)} sub={`${100 - newPct}%`} />
              </div>
            </div>
          )}
        </ReportCard>

        <ReportCard title="לקוחות מובילים לפי הכנסות" icon={<CreditCard className="w-4 h-4 text-brand-500" />}>
          {(data.topCustomers?.length ?? 0) === 0 ? (
            <EmptyState text="אין הכנסות בתקופה זו" />
          ) : (
            <BarList
              numbered
              items={data.topCustomers.map((c) => ({
                key: c.id,
                label: c.name,
                href: `/customers/${c.id}`,
                value: c.revenue,
                display: formatCurrency(c.revenue),
                sub: `${c.count} תשלומים`,
              }))}
            />
          )}
        </ReportCard>

        <ReportCard
          title="יתרות פתוחות"
          icon={<AlertCircle className="w-4 h-4 text-amber-500" />}
          subtitle={`סה״כ ${formatCurrency(f.outstanding.total)} · ${f.outstanding.customers} לקוחות · נכון להיום`}
        >
          {f.outstanding.top.length === 0 ? (
            <EmptyState text="אין יתרות פתוחות" />
          ) : (
            <div className="space-y-2">
              {f.outstanding.top.slice(0, 5).map((c) => (
                <Link
                  key={c.customerId}
                  href={`/customers/${c.customerId}`}
                  className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-petra-text truncate">{c.name}</p>
                    <p className="text-[11px] text-petra-muted">פתוח מ-{new Date(c.oldest).toLocaleDateString("he-IL")}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-700 tabular-nums flex-shrink-0">{formatCurrency(c.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
