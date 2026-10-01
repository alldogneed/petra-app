"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Calendar, CreditCard, Users, Target, TrendingUp, Sparkles, Clock, ListTodo, Briefcase } from "lucide-react";
import type { ReactNode } from "react";
import type { AnalyticsData } from "@/lib/analytics-types";
import { formatCurrency } from "@/lib/utils";
import { formatMonthKey } from "@/lib/lead-attribution";
import { KpiCard, ChangeIndicator, ReportCard, EmptyState, ChartTooltip, CHART_COLORS, fmtMoney } from "./ReportBlocks";

function Highlight({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-petra-muted min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold text-petra-text text-end">{value}</span>
    </div>
  );
}

export function OverviewTab({ data }: { data: AnalyticsData }) {
  const o = data.overview;
  const monthly = data.finance?.monthly ?? [];
  const hasMonthly = monthly.some((m) => m.revenue > 0);

  const dow = data.charts.appointmentsByDayOfWeek ?? [];
  const busiestDay = dow.reduce<{ day: string; count: number } | null>((best, d) => (d.count > 0 && (!best || d.count > best.count) ? d : best), null);
  const hours = data.charts.appointmentsByHour ?? [];
  const busiestHour = hours.reduce<{ label: string; count: number } | null>((best, h) => (h.count > 0 && (!best || h.count > best.count) ? h : best), null);
  const topService = data.charts.revenueByService?.[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={<CreditCard className="w-5 h-5" />}
          iconClassName="bg-emerald-50 text-emerald-500"
          label="הכנסות"
          value={fmtMoney(o.revenue)}
          sub={o.paymentCount != null ? `${o.paymentCount} תשלומים` : undefined}
          change={o.revenue != null ? o.revenueChange : undefined}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          iconClassName="bg-blue-50 text-blue-500"
          label="תורים"
          value={o.totalAppointments}
          sub={
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              {o.completionRate}% הושלמו
              {o.completionRateChange !== undefined && <ChangeIndicator value={o.completionRateChange} />}
            </span>
          }
          change={o.appointmentsChange}
          progress={o.totalAppointments > 0 ? o.completionRate : null}
          progressClassName="bg-blue-400"
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          iconClassName="bg-purple-50 text-purple-500"
          label="לקוחות חדשים"
          value={o.newCustomers}
          sub={`${o.totalCustomers} לקוחות בסה״כ`}
          change={o.newCustomersChange}
        />
        <KpiCard
          icon={<Target className="w-5 h-5" />}
          iconClassName="bg-amber-50 text-amber-500"
          label="לידים שנסגרו"
          value={data.leads.wonThisPeriod}
          sub={`${data.leads.wonThisPeriod + data.leads.lostThisPeriod > 0 ? `${data.leads.conversionRate}%` : "—"} המרה`}
          change={data.leads.wonChange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportCard
          className="lg:col-span-2"
          title="הכנסות לפי חודש"
          subtitle="12 החודשים האחרונים · תשלומים ששולמו"
          icon={<TrendingUp className="w-4 h-4 text-brand-500" />}
        >
          {!data.finance ? (
            <EmptyState text="אין הרשאה לנתונים כספיים" />
          ) : !hasMonthly ? (
            <EmptyState text="אין הכנסות ב-12 החודשים האחרונים" />
          ) : (
            <div dir="ltr" className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={formatMonthKey} tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip valueFormatter={formatCurrency} labelFormatter={formatMonthKey} />} />
                  <Bar dataKey="revenue" name="הכנסות" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ReportCard>

        <ReportCard title="בקצרה" icon={<Sparkles className="w-4 h-4 text-brand-500" />}>
          <div className="space-y-2">
            <Highlight icon={<ListTodo className="w-4 h-4 text-indigo-500" />} label="משימות שהושלמו בתקופה" value={data.tasks.completedThisPeriod} />
            <Highlight icon={<ListTodo className="w-4 h-4 text-slate-400" />} label="משימות פתוחות כעת" value={data.tasks.open} />
            {busiestDay && <Highlight icon={<Calendar className="w-4 h-4 text-blue-500" />} label="היום העמוס בשבוע" value={`יום ${busiestDay.day}`} />}
            {busiestHour && <Highlight icon={<Clock className="w-4 h-4 text-violet-500" />} label="השעה העמוסה" value={busiestHour.label} />}
            {topService && topService.revenue > 0 && (
              <Highlight icon={<Briefcase className="w-4 h-4 text-emerald-500" />} label="השירות המכניס ביותר" value={topService.name} />
            )}
          </div>
        </ReportCard>
      </div>
    </div>
  );
}
