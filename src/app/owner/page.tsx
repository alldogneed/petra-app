"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";

interface Stats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  activeUsers: number;
  recentAuditLogs: number;
}

interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  targetType: string | null;
  targetId: string | null;
  actor?: { name: string; email: string } | null;
}

export default function OwnerDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["owner", "stats"],
    queryFn: () => fetchJSON("/api/owner/stats"),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ["owner", "audit-logs", "recent"],
    queryFn: () => fetchJSON("/api/owner/audit-logs?limit=10"),
  });

  const statCards = stats
    ? [
        {
          title: "סה״כ עסקים",
          value: stats.totalTenants,
          sub: `${stats.activeTenants} פעילים · ${stats.suspendedTenants} מושהים`,
          icon: Building2,
          color: "bg-blue-500",
          href: "/owner/tenants",
        },
        {
          title: "משתמשי פלטפורמה",
          value: stats.totalUsers,
          sub: `${stats.activeUsers} פעילים`,
          icon: Users,
          color: "bg-violet-500",
          href: "/owner/users",
        },
        {
          title: "אירועי ביקורת (24ש׳)",
          value: stats.recentAuditLogs,
          sub: "24 שעות אחרונות",
          icon: Activity,
          color: "bg-orange-500",
          href: "/owner/audit-logs",
        },
      ]
    : [];

  return (
    <div>
      <h1 className="page-title mb-6">דשבורד פלטפורמה</h1>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href}>
                <div className="card card-hover p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", card.color)}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-slate-500">{card.title}</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{card.value.toLocaleString()}</div>
                  <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Recent audit log */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">פעילות אחרונה</h2>
          <Link href="/owner/audit-logs" className="text-xs text-orange-500 hover:text-orange-600">
            הצג הכל ←
          </Link>
        </div>
        {logsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(!logsData?.logs || logsData.logs.length === 0) && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">אין פעילות עדיין</div>
            )}
            {logsData?.logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                  {log.actor && (
                    <span className="mr-2 text-xs text-slate-500">{log.actor.email}</span>
                  )}
                  {log.targetType && (
                    <span className="mr-1 text-xs text-slate-400">
                      ← {log.targetType} {log.targetId?.slice(0, 8)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(log.timestamp).toLocaleString("he-IL")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
