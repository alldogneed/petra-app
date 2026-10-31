"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Calendar, Clock, PawPrint, Repeat, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import type { AnalyticsData } from "@/lib/analytics-types";
import { ReportCard, EmptyState, BarList, MiniStat, ChartTooltip, CHART_COLORS, fmtRate, useReportFormatters } from "./ReportBlocks";

const axisTick = { fontSize: 10, fill: "#64748b" };

export function AppointmentsTab({ data }: { data: AnalyticsData }) {
  const o = data.overview;
  const byDate = data.charts.appointmentsByDate ?? [];
  const dow = data.charts.appointmentsByDayOfWeek ?? [];
  const hours = data.charts.appointmentsByHour ?? [];
  const r = data.retention;
  const pets = data.petDemographics;
  const useLine = byDate.length > 45;
  const t = useTranslations("analytics.appointmentsTab");
  const { cfg } = useBusinessLocale();
  const { formatDayLabel } = useReportFormatters();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MiniStat label={t("completed")} value={o.completedAppointments} tone="emerald" />
        <MiniStat label={t("canceled")} value={o.canceledAppointments} sub={t("ofAppointments", { rate: fmtRate(o.cancellationRate) })} tone="red" />
        <MiniStat label={t("noShow")} value={o.noShowAppointments} sub={t("ofAppointments", { rate: fmtRate(o.noShowRate) })} tone="amber" />
      </div>

      <ReportCard title={t("byDate")} icon={<Calendar className="w-4 h-4 text-brand-500" />}>
        {byDate.length === 0 || byDate.every((d) => d.count === 0) ? (
          <EmptyState text={t("noAppointments")} />
        ) : (
          <div dir="ltr" className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {useLine ? (
                <LineChart data={byDate} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<ChartTooltip labelFormatter={formatDayLabel} />} />
                  <Line type="monotone" dataKey="count" name={t("seriesName")} stroke={CHART_COLORS.brand} strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <BarChart data={byDate} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip labelFormatter={formatDayLabel} />} />
                  <Bar dataKey="count" name={t("seriesName")} fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </ReportCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportCard title={t("byDayOfWeek")} subtitle={t("excludingCanceled")} icon={<Calendar className="w-4 h-4 text-brand-500" />}>
          {!dow.some((d) => d.count > 0) ? (
            <EmptyState text={t("noData")} />
          ) : (
            <div dir="ltr" className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                {/* Sunday on the right, like a Hebrew calendar (left in LTR) */}
                <BarChart data={cfg.dir === "rtl" ? [...dow].reverse() : dow} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t("seriesName")} fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ReportCard>

        <ReportCard title={t("byHour")} subtitle={t("excludingCanceled")} icon={<Clock className="w-4 h-4 text-brand-500" />}>
          {!hours.some((h) => h.count > 0) ? (
            <EmptyState text={t("noData")} />
          ) : (
            <div dir="ltr" className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={4} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} content={<ChartTooltip />} />
                  <Bar dataKey="count" name={t("seriesName")} fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ReportCard>

        <ReportCard title={t("retention")} icon={<Repeat className="w-4 h-4 text-emerald-500" />}>
          <p className="text-3xl font-bold text-emerald-600 tabular-nums">{fmtRate(r.retentionRate)}</p>
          <p className="text-xs text-petra-text mt-1">
            {r.customersWithAppointments > 0
              ? t("returned", { returning: r.returningCustomers, total: r.customersWithAppointments })
              : t("noPreviousActive")}
          </p>
          {r.retentionRate != null && (
            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${r.retentionRate}%` }} />
            </div>
          )}
          <p className="text-[11px] text-petra-muted mt-3">
            {t("retentionHint")}
          </p>
        </ReportCard>

        <ReportCard
          title={t("petMix")}
          icon={<PawPrint className="w-4 h-4 text-brand-500" />}
          action={pets && pets.total > 0 ? <span className="text-xs text-petra-muted">{t("petsCount", { count: pets.total })}</span> : undefined}
        >
          {!pets || pets.total === 0 ? (
            <EmptyState text={t("noPets")} />
          ) : (
            <div className="space-y-5">
              <BarList
                items={pets.bySpecies.map(({ species, count }) => ({
                  key: species,
                  label: t.has(`species.${species}`) ? t(`species.${species}`) : species,
                  value: count,
                  display: `${count} (${Math.round((count / pets.total) * 100)}%)`,
                }))}
              />
              {pets.topBreeds.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-petra-muted mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> {t("topBreeds")}
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
