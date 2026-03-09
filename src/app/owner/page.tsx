"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Activity, Loader2, TrendingUp, Clock, PauseCircle } from "lucide-react";
import Link from "next/link";
import { fetchJSON, cn } from "@/lib/utils";

interface TierBreakdownRow {
  tier: string;
  count: number;
  pricePerMonth: number;
  contribution: number;
}

interface Stats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  activeUsers: number;
  recentAuditLogs: number;
  mrr: number;
  trialCount: number;
  tierBreakdown: TierBreakdownRow[];
}

const TIER_LABEL: Record<string, string> = {
  free: "חינמי",
  basic: "Basic",
  groomer: "Groomer+",
  groomer_plus: "Groomer+",
  pro: "Pro",
  service_dog: "Service Dog",
};

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

      {/* MRR section */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : stats && (
        <div className="mb-6 space-y-4">
          {/* MRR stat cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-slate-500">MRR</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">₪{stats.mrr.toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-1">הכנסה חוזרת חודשית</div>
            </div>
            <Link href="/owner/tenants">
              <div className="card card-hover p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-slate-500">עסקים פעילים</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{stats.activeTenants}</div>
                <div className="text-xs text-slate-400 mt-1">מתוך {stats.totalTenants} סה״כ</div>
              </div>
            </Link>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-slate-500">בתקופת ניסיון</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.trialCount}</div>
              <div className="text-xs text-slate-400 mt-1">trial פעיל</div>
            </div>
            <Link href="/owner/tenants?status=suspended">
              <div className="card card-hover p-5">
                <div className="flex items-center gap-2 mb-2">
                  <PauseCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-slate-500">מושהים</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{stats.suspendedTenants}</div>
                <div className="text-xs text-slate-400 mt-1">חשבונות מושהים</div>
              </div>
            </Link>
          </div>

          {/* Tier breakdown table */}
          {stats.tierBreakdown.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <h2 className="font-semibold text-slate-900 text-sm">פירוט לפי מנוי</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="table-header-cell">מנוי</th>
                    <th className="table-header-cell text-center">עסקים</th>
                    <th className="table-header-cell text-center">מחיר/חודש</th>
                    <th className="table-header-cell text-center">תרומה ל-MRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.tierBreakdown
                    .sort((a, b) => b.contribution - a.contribution)
                    .map((row) => (
                      <tr key={row.tier} className="hover:bg-slate-50/50">
                        <td className="table-cell">
                          <span className="font-medium text-sm text-slate-800">
                            {TIER_LABEL[row.tier] ?? row.tier}
                          </span>
                        </td>
                        <td className="table-cell text-center text-sm">{row.count}</td>
                        <td className="table-cell text-center text-sm">₪{row.pricePerMonth}</td>
                        <td className="table-cell text-center">
                          <span className="font-semibold text-sm text-green-700">
                            ₪{row.contribution.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="table-cell font-bold text-slate-900">סה״כ MRR</td>
                    <td className="table-cell text-center font-bold">{stats.activeTenants}</td>
                    <td className="table-cell" />
                    <td className="table-cell text-center">
                      <span className="font-bold text-green-700">₪{stats.mrr.toLocaleString()}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Other stat cards */}
      {!statsLoading && stats && (
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
            {logsData?.logs?.map((log) => (
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
