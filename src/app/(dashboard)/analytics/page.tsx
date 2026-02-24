"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  Users,
  Calendar,
  CreditCard,
  Target,
  TrendingUp,
  ListTodo,
  GraduationCap,
  Hotel,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { cn, formatCurrency, fetchJSON } from "@/lib/utils";

interface AnalyticsData {
  period: string;
  from: string;
  to: string;
  overview: {
    totalCustomers: number;
    newCustomers: number;
    newCustomersChange: number;
    totalAppointments: number;
    appointmentsChange: number;
    completedAppointments: number;
    canceledAppointments: number;
    completionRate: number;
    revenue: number;
    revenueChange: number;
    paymentCount: number;
  };
  tasks: {
    open: number;
    completedThisPeriod: number;
  };
  leads: {
    active: number;
    wonThisPeriod: number;
    lostThisPeriod: number;
    conversionRate: number;
  };
  training: {
    activePrograms: number;
  };
  boarding: {
    staysThisPeriod: number;
  };
  charts: {
    appointmentsByDate: { date: string; count: number }[];
  };
}

const PERIODS = [
  { id: "week", label: "שבוע" },
  { id: "month", label: "חודש" },
  { id: "quarter", label: "רבעון" },
  { id: "year", label: "שנה" },
];

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs text-slate-400"><Minus className="w-3 h-3" /> 0%</span>;
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

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("month");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", period],
    queryFn: () => fetchJSON<AnalyticsData>(`/api/analytics?period=${period}`),
  });

  const maxChartValue = data
    ? Math.max(...data.charts.appointmentsByDate.map((d) => d.count), 1)
    : 1;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-500" />
            אנליטיקס
          </h1>
          <p className="text-sm text-muted mt-1">סקירה כללית של ביצועי העסק</p>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                period === p.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5 animate-pulse h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="card p-5 animate-pulse h-64" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Revenue */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </div>
                <ChangeIndicator value={data.overview.revenueChange} />
              </div>
              <div className="text-2xl font-bold text-slate-800">{formatCurrency(data.overview.revenue)}</div>
              <div className="text-xs text-muted mt-1">הכנסות · {data.overview.paymentCount} תשלומים</div>
            </div>

            {/* Appointments */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <ChangeIndicator value={data.overview.appointmentsChange} />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.overview.totalAppointments}</div>
              <div className="text-xs text-muted mt-1">
                תורים · {data.overview.completionRate}% הושלמו
              </div>
            </div>

            {/* New Customers */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <ChangeIndicator value={data.overview.newCustomersChange} />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.overview.newCustomers}</div>
              <div className="text-xs text-muted mt-1">לקוחות חדשים · {data.overview.totalCustomers} סה״כ</div>
            </div>

            {/* Leads */}
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Target className="w-5 h-5 text-amber-500" />
                </div>
                {data.leads.conversionRate > 0 && (
                  <span className="text-xs text-emerald-600 font-medium">{data.leads.conversionRate}% המרה</span>
                )}
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.leads.active}</div>
              <div className="text-xs text-muted mt-1">
                לידים פעילים · {data.leads.wonThisPeriod} נסגרו
              </div>
            </div>
          </div>

          {/* Charts & Details Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Appointments Chart */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-500" />
                תורים לפי תאריך
              </h3>
              {data.charts.appointmentsByDate.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-muted">
                  אין נתונים לתקופה זו
                </div>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {data.charts.appointmentsByDate.map((d, i) => {
                    const height = Math.max((d.count / maxChartValue) * 100, 4);
                    const dateStr = new Date(d.date).toLocaleDateString("he-IL", {
                      day: "numeric",
                      month: "numeric",
                    });
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          {d.count}
                        </span>
                        <div
                          className="w-full rounded-t-md bg-brand-400 hover:bg-brand-500 transition-colors cursor-default"
                          style={{ height: `${height}%`, minHeight: "4px" }}
                          title={`${dateStr}: ${d.count} תורים`}
                        />
                        {data.charts.appointmentsByDate.length <= 15 && (
                          <span className="text-[8px] text-muted">{dateStr}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Performance Summary */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                סיכום ביצועים
              </h3>
              <div className="space-y-3">
                {/* Appointments Breakdown */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-slate-600">תורים שהושלמו</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{data.overview.completedAppointments}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-sm text-slate-600">תורים שבוטלו</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{data.overview.canceledAppointments}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-sm text-slate-600">לידים שאבדו</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{data.leads.lostThisPeriod}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm text-slate-600">משימות שהושלמו</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{data.tasks.completedThisPeriod}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ListTodo className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-800">{data.tasks.open}</div>
                <div className="text-xs text-muted">משימות פתוחות</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-teal-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-800">{data.training.activePrograms}</div>
                <div className="text-xs text-muted">תוכניות אילוף פעילות</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center">
                <Hotel className="w-4 h-4 text-pink-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-800">{data.boarding.staysThisPeriod}</div>
                <div className="text-xs text-muted">שהיות בפנסיון</div>
              </div>
            </div>

            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-slate-800">{data.leads.wonThisPeriod}</div>
                <div className="text-xs text-muted">לידים שנסגרו</div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
