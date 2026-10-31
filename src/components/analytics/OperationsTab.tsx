"use client";

import { useVertical } from "@/hooks/useVertical";
import Link from "next/link";
import { GraduationCap, Hotel, Users, Calendar, TrendingUp, CreditCard, BedDouble } from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics-types";
import { KpiCard, ReportCard, fmtMoney, fmtRate } from "./ReportBlocks";

export function OperationsTab({ data }: { data: AnalyticsData }) {
  const t = data.training;
  const b = data.boarding;
  const noRooms = b.capacityNights === 0;
  // Verticals: "generic" — programs without groups, no boarding (docs/verticals).
  const { isGeneric, hides, v } = useVertical();

  return (
    <div className="space-y-4">
      <ReportCard title={v("analytics.training_title")} icon={<GraduationCap className="w-4 h-4 text-teal-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon={<GraduationCap className="w-5 h-5" />} iconClassName="bg-teal-50 text-teal-500" label={v("analytics.active_programs")} value={t.activePrograms} />
          <KpiCard icon={<TrendingUp className="w-5 h-5" />} iconClassName="bg-teal-50 text-teal-500" label="מפגשים שהושלמו בתקופה" value={t.completedSessionsThisPeriod} />
          {!isGeneric && <KpiCard icon={<Users className="w-5 h-5" />} iconClassName="bg-violet-50 text-violet-500" label="קבוצות אילוף פעילות" value={t.activeGroups} />}
          {!isGeneric && <KpiCard icon={<Calendar className="w-5 h-5" />} iconClassName="bg-fuchsia-50 text-fuchsia-500" label="מפגשי קבוצה בתקופה" value={t.groupSessionsThisPeriod} />}
          {t.revenue !== null && (
            <KpiCard icon={<CreditCard className="w-5 h-5" />} iconClassName="bg-emerald-50 text-emerald-500" label={v("analytics.program_revenue")} value={fmtMoney(t.revenue)} />
          )}
        </div>
      </ReportCard>

      {!hides("boarding") && (
      <ReportCard title="פנסיון" icon={<Hotel className="w-4 h-4 text-pink-500" />}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard
            icon={<Hotel className="w-5 h-5" />}
            iconClassName="bg-pink-50 text-pink-500"
            label="שהיות בפנסיון"
            value={b.staysThisPeriod}
            change={b.staysChange}
          />
          <KpiCard
            icon={<BedDouble className="w-5 h-5" />}
            iconClassName="bg-blue-50 text-blue-500"
            label="תפוסה"
            value={fmtRate(b.occupancyRate)}
            progress={b.occupancyRate}
            progressClassName="bg-blue-400"
            sub={
              noRooms ? (
                <Link href="/boarding" className="text-brand-600 hover:underline">
                  הגדר חדרים כדי לראות תפוסה
                </Link>
              ) : (
                `${b.occupiedNights} מתוך ${b.capacityNights} לילות-חדר`
              )
            }
          />
          {b.revenue !== null && (
            <KpiCard icon={<CreditCard className="w-5 h-5" />} iconClassName="bg-emerald-50 text-emerald-500" label="הכנסות פנסיון בתקופה" value={fmtMoney(b.revenue)} />
          )}
        </div>
      </ReportCard>
      )}
    </div>
  );
}
