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
  Share2,
  PawPrint,
} from "lucide-react";
import { cn, formatCurrency, fetchJSON } from "@/lib/utils";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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
    revenueByService: { name: string; revenue: number }[];
    appointmentsByDayOfWeek: { day: string; count: number }[];
    appointmentsByHour: { hour: number; label: string; count: number }[];
  };
  topCustomers: { id: string; name: string; revenue: number; count: number }[];
  petDemographics?: {
    total: number;
    bySpecies: { species: string; count: number }[];
    topBreeds: { breed: string; count: number }[];
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
  return (
    <ProtectedRoute requiredRole="owner">
      <AnalyticsContent />
    </ProtectedRoute>
  );
}

function AnalyticsContent() {
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
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="page-title flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-500" />
          אנליטיקס
        </h1>
        <p className="text-sm text-petra-muted">סקירה כללית של ביצועי העסק</p>
        <div className="flex gap-1.5 flex-wrap">
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
          {data && (
            <a
              href={(() => {
                const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? period;
                const from = new Date(data.from).toLocaleDateString("he-IL");
                const to = new Date(data.to).toLocaleDateString("he-IL");
                const lines = [
                  `📊 *דוח ביצועים — ${periodLabel}*`,
                  `${from} – ${to}`,
                  "",
                  `💰 הכנסות: ${formatCurrency(data.overview.revenue)}`,
                  `📅 תורים: ${data.overview.totalAppointments} (${data.overview.completionRate}% הושלמו)`,
                  `👥 לקוחות חדשים: ${data.overview.newCustomers}`,
                  `🎯 לידים שנסגרו: ${data.leads.wonThisPeriod} (${data.leads.conversionRate}% המרה)`,
                  `✅ משימות הושלמו: ${data.tasks.completedThisPeriod}`,
                  `🐾 שהות פנסיון: ${data.boarding.staysThisPeriod}`,
                ].join("\n");
                return `https://wa.me/?text=${encodeURIComponent(lines)}`;
              })()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-1.5 hidden sm:flex"
              title="שתף דוח בוואטסאפ"
            >
              <Share2 className="w-4 h-4" />
              שתף דוח
            </a>
          )}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

          {/* Top Customers + Revenue by Service */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Customers by Revenue */}
            {(data.topCustomers?.length ?? 0) > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-500" />
                  לקוחות מובילים לפי הכנסות
                </h3>
                <div className="space-y-3">
                  {data.topCustomers.map((c, i) => {
                    const maxRev = data.topCustomers[0].revenue;
                    const pct = maxRev > 0 ? Math.round((c.revenue / maxRev) * 100) : 0;
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-petra-muted w-5 text-left">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-petra-text truncate">{c.name}</span>
                            <span className="text-xs font-semibold text-brand-600 flex-shrink-0 mr-2">
                              {formatCurrency(c.revenue)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div
                              className="h-full rounded-full bg-brand-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-petra-muted mt-0.5">{c.count} תשלומים</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Revenue by Service */}
            {(data.charts.revenueByService?.length ?? 0) > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-brand-500" />
                  הכנסות לפי שירות
                </h3>
                <div className="space-y-3">
                  {data.charts.revenueByService.map((s, i) => {
                    const maxRev = data.charts.revenueByService[0].revenue;
                    const pct = maxRev > 0 ? Math.round((s.revenue / maxRev) * 100) : 0;
                    const colors = [
                      "bg-emerald-400", "bg-blue-400", "bg-violet-400",
                      "bg-amber-400", "bg-pink-400", "bg-teal-400",
                      "bg-orange-400", "bg-indigo-400"
                    ];
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-petra-text truncate">{s.name}</span>
                            <span className="text-xs font-semibold text-petra-text flex-shrink-0 mr-2">
                              {formatCurrency(s.revenue)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full">
                            <div
                              className={cn("h-full rounded-full", colors[i % colors.length])}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Scheduling Heatmap */}
          {((data.charts.appointmentsByDayOfWeek?.some((d) => d.count > 0)) ||
            (data.charts.appointmentsByHour?.length ?? 0) > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* By Day of Week */}
              {data.charts.appointmentsByDayOfWeek?.some((d) => d.count > 0) && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-500" />
                    תורים לפי יום בשבוע
                  </h3>
                  {(() => {
                    const maxCount = Math.max(...data.charts.appointmentsByDayOfWeek.map((d) => d.count), 1);
                    return (
                      <div className="flex items-end gap-2 h-32">
                        {data.charts.appointmentsByDayOfWeek.map((d, i) => {
                          const pct = Math.max((d.count / maxCount) * 100, d.count > 0 ? 4 : 0);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              {d.count > 0 && (
                                <span className="text-[9px] text-petra-muted font-medium">{d.count}</span>
                              )}
                              <div
                                className="w-full rounded-t-md bg-brand-400 hover:bg-brand-500 transition-colors"
                                style={{ height: `${pct}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                              />
                              <span className="text-[9px] text-petra-muted">{d.day}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* By Hour */}
              {(data.charts.appointmentsByHour?.length ?? 0) > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-500" />
                    תורים לפי שעה
                  </h3>
                  {(() => {
                    const maxCount = Math.max(...data.charts.appointmentsByHour.map((h) => h.count), 1);
                    return (
                      <div className="flex items-end gap-1 h-32">
                        {data.charts.appointmentsByHour.map((h) => {
                          const pct = Math.max((h.count / maxCount) * 100, 4);
                          return (
                            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                              <span className="text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                {h.count}
                              </span>
                              <div
                                className="w-full rounded-t-md bg-violet-400 hover:bg-violet-500 transition-colors"
                                style={{ height: `${pct}%` }}
                                title={`${h.label}: ${h.count} תורים`}
                              />
                              <span className="text-[8px] text-muted">{h.hour}:00</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        {/* Pet Demographics */}
        {data.petDemographics && data.petDemographics.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Species breakdown */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <PawPrint className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-petra-text">הרכב חיות המחמד</h3>
                <span className="text-xs text-petra-muted mr-auto">{data.petDemographics.total} חיות</span>
              </div>
              <div className="space-y-2">
                {data.petDemographics.bySpecies.map(({ species, count }) => {
                  const pct = Math.round((count / data.petDemographics!.total) * 100);
                  const labels: Record<string, string> = { dog: "🐕 כלבים", cat: "🐈 חתולים", other: "🐾 אחר" };
                  return (
                    <div key={species}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-petra-text">{labels[species] ?? species}</span>
                        <span className="text-petra-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top breeds */}
            {data.petDemographics.topBreeds.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <PawPrint className="w-4 h-4 text-violet-500" />
                  <h3 className="text-sm font-bold text-petra-text">גזעים מובילים</h3>
                </div>
                <div className="space-y-2">
                  {data.petDemographics.topBreeds.map(({ breed, count }, i) => {
                    const maxCount = data.petDemographics!.topBreeds[0].count;
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={breed} className="flex items-center gap-3">
                        <span className="text-[11px] text-petra-muted w-4 text-left">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="font-medium text-petra-text truncate">{breed}</span>
                            <span className="text-petra-muted flex-shrink-0 mr-2">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </>
      ) : null}
    </div>
  );
}
