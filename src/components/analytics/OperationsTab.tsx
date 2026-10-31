"use client";

import Link from "next/link";
import { GraduationCap, Hotel, Users, Calendar, TrendingUp, CreditCard, BedDouble } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AnalyticsData } from "@/lib/analytics-types";
import { KpiCard, ReportCard, fmtRate, useReportFormatters } from "./ReportBlocks";

export function OperationsTab({ data }: { data: AnalyticsData }) {
  const t = useTranslations("analytics.operationsTab");
  const { fmtMoney } = useReportFormatters();
  const tr = data.training;
  const b = data.boarding;
  const noRooms = b.capacityNights === 0;

  return (
    <div className="space-y-4">
      <ReportCard title={t("training")} icon={<GraduationCap className="w-4 h-4 text-teal-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon={<GraduationCap className="w-5 h-5" />} iconClassName="bg-teal-50 text-teal-500" label={t("activePrograms")} value={tr.activePrograms} />
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} iconClassName="bg-teal-50 text-teal-500" label={t("completedSessions")} value={tr.completedSessionsThisPeriod} />
          <KpiCard icon={<Users className="w-5 h-5" />} iconClassName="bg-violet-50 text-violet-500" label={t("activeGroups")} value={tr.activeGroups} />
          <KpiCard icon={<Calendar className="w-5 h-5" />} iconClassName="bg-fuchsia-50 text-fuchsia-500" label={t("groupSessions")} value={tr.groupSessionsThisPeriod} />
          {tr.revenue !== null && (
            <KpiCard icon={<CreditCard className="w-5 h-5" />} iconClassName="bg-emerald-50 text-emerald-500" label={t("trainingRevenue")} value={fmtMoney(tr.revenue)} />
          )}
        </div>
      </ReportCard>

      <ReportCard title={t("boarding")} icon={<Hotel className="w-4 h-4 text-pink-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            icon={<Hotel className="w-5 h-5" />}
            iconClassName="bg-pink-50 text-pink-500"
            label={t("stays")}
            value={b.staysThisPeriod}
            change={b.staysChange}
          />
          <KpiCard
            icon={<BedDouble className="w-5 h-5" />}
            iconClassName="bg-blue-50 text-blue-500"
            label={t("occupancy")}
            value={fmtRate(b.occupancyRate)}
            progress={b.occupancyRate}
            progressClassName="bg-blue-400"
            sub={
              noRooms ? (
                <Link href="/boarding" className="text-brand-600 hover:underline">
                  {t("setupRooms")}
                </Link>
              ) : (
                t("roomNights", { occupied: b.occupiedNights, capacity: b.capacityNights })
              )
            }
          />
          {b.revenue !== null && (
            <KpiCard icon={<CreditCard className="w-5 h-5" />} iconClassName="bg-emerald-50 text-emerald-500" label={t("boardingRevenue")} value={fmtMoney(b.revenue)} />
          )}
        </div>
      </ReportCard>
    </div>
  );
}
