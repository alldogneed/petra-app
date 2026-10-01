"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Calendar, Clock, PawPrint, Repeat, Activity } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics-types";
import { ReportCard, EmptyState, BarList, MiniStat, ChartTooltip, CHART_COLORS, fmtRate, formatDayLabel } from "./ReportBlocks";

const SPECIES_LABELS: Record<string, string> = { dog: "🐕 כלבים", cat: "🐈 חתולים", other: "🐾 אחר" };

const axisTick = { fontSize: 10, fill: "#64748b" };

export function AppointmentsTab({ data }: { data: AnalyticsData }) {
  const o = data.overview;
  const byDate = data.charts.appointmentsByDate ?? [];
  const dow = data.charts.appointmentsByDayOfWeek ?? [];
  const hours = data.charts.appointmentsByHour ?? [];
  const r = data.retention;
  const pets = data.petDemographics;
  const useLine = byDate.length > 45;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MiniStat label="תורים שהושלמו" value={o.completedAppointments} tone="emerald" />
        <MiniStat label="ביטולים" value={o.canceledAppointments} sub={`${fmtRate(o.cancellationRate)} מהתורים`} tone="red" />
        <MiniStat label="לא הגיעו" value={o.noShowAppointments} sub={`${fmtRate(o.noShowRate)} מהתורים`} tone="amber" />
      </div>

      <ReportCard title="תורים לפי תאריך" icon={<Calendar className="w-4 h-4 text-brand-500" />}>
        {byDate.length === 0 || byDate.every((d) => d.count === 0) ? (
          <EmptyState text="אין תורים בתקופה זו" />
        ) : (
          <div dir="ltr" className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {useLine ? (
                <LineChart data={byDate} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<ChartTooltip labelFormatter={formatDayLabel} />} />
                  <Line type="monotone" dataKey="count" name="תורים" stroke={CHART_COLORS.brand} strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <BarChart data={byDate} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip labelFormatter={formatDayLabel} />} />
                  <Bar dataKey="count" name="תורים" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title="תורים לפי יום בשבוע" subtitle="ללא תורים שבוטלו" icon={<Calendar className="w-4 h-4 text-brand-500" />}>
          {!dow.some((d) => d.count > 0) ? (
            <EmptyState text="אין נתונים לתקופה זו" />
          ) : (
            <div dir="ltr" className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                {/* Sunday on the right, like a Hebrew calendar */}
                <BarChart data={[...dow].reverse()} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name="תורים" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ReportCard>

        <ReportCard title="תורים לפי שעה" subtitle="ללא תורים שבוטלו" icon={<Clock className="w-4 h-4 text-brand-500" />}>
          {!hours.some((h) => h.count > 0) ? (
            <EmptyState text="אין נתונים לתקופה זו" />
          ) : (
            <div dir="ltr" className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={4} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name="תורים" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ReportCard>

        <ReportCard title="שימור לקוחות" icon={<Repeat className="w-4 h-4 text-emerald-500" />}>
          <p className="text-3xl font-bold text-emerald-600 tabular-nums">{fmtRate(r.retentionRate)}</p>
          <p className="text-xs text-petra-text mt-1">
            {r.customersWithAppointments > 0
              ? `${r.returningCustomers} מתוך ${r.customersWithAppointments} לקוחות חזרו`
              : "לא היו לקוחות פעילים בתקופה הקודמת"}
          </p>
          {r.retentionRate != null && (
            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${r.retentionRate}%` }} />
            </div>
          )}
          <p className="text-[11px] text-petra-muted mt-3">
            לקוחות שהיו פעילים בתקופה הקודמת (תור שהושלם או תשלום) וחזרו להיות פעילים בתקופה הנוכחית.
          </p>
        </ReportCard>

        <ReportCard
          title="הרכב חיות המחמד"
          icon={<PawPrint className="w-4 h-4 text-brand-500" />}
          action={pets && pets.total > 0 ? <span className="text-xs text-petra-muted">{pets.total} חיות</span> : undefined}
        >
          {!pets || pets.total === 0 ? (
            <EmptyState text="אין חיות מחמד רשומות" />
          ) : (
            <div className="space-y-5">
              <BarList
                items={pets.bySpecies.map(({ species, count }) => ({
                  key: species,
                  label: SPECIES_LABELS[species] ?? species,
                  value: count,
                  display: `${count} (${Math.round((count / pets.total) * 100)}%)`,
                }))}
              />
              {pets.topBreeds.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-petra-muted mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> גזעים מובילים
                  </p>
                  <BarList
                    numbered
                    barClassName="bg-violet-400"
                    items={pets.topBreeds.map(({ breed, count }) => ({ key: breed, label: breed, value: count, display: count }))}
                  />
                </div>
              )}
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}
