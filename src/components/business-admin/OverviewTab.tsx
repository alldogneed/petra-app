"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  Users,
  Activity,
  UserCheck,
  RefreshCw,
  Calendar,
  CreditCard,
} from "lucide-react";
import { OverviewData, ActivityRow } from "./shared";

export function OverviewTab() {
  const { data, isLoading, refetch, isFetching } = useQuery<OverviewData>({
    queryKey: ["ba-overview"],
    queryFn: () => fetch("/api/business-admin/overview").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const stats = [
    {
      label: "חברי צוות פעילים",
      value: data?.teamCount ?? "—",
      icon: Users,
      color: "#3B82F6",
      bg: "#EFF6FF",
    },
    {
      label: "לקוחות",
      value: data?.customerCount ?? "—",
      icon: UserCheck,
      color: "#10B981",
      bg: "#ECFDF5",
    },
    {
      label: "תורים היום",
      value: data?.todayAppts ?? "—",
      icon: Calendar,
      color: "#F97316",
      bg: "#FFF7ED",
    },
    {
      label: "הכנסות החודש",
      value: data ? formatCurrency(data.monthlyRevenue) : "—",
      icon: CreditCard,
      color: "#8B5CF6",
      bg: "#F5F3FF",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg }}
              >
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-petra-muted">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity feed */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-500" />
            פעילות אחרונה
          </h3>
          <button
            onClick={() => refetch()}
            className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            רענן
          </button>
        </div>

        {isLoading ? (
          <PetraLoader variant="inline" />
        ) : !data?.recentActivity?.length ? (
          <p className="text-sm text-petra-muted text-center py-6">אין פעילות עדיין</p>
        ) : (
          <div>
            {data.recentActivity.map((e) => (
              <ActivityRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
