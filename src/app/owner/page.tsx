import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Building2, Users, Activity } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "דשבורד פלטפורמה — Petra Admin" };

async function getStats() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [totalTenants, activeTenants, suspendedTenants, totalUsers, activeUsers, recentAuditLogs] =
    await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { status: "active" } }),
      prisma.business.count({ where: { status: "suspended" } }),
      prisma.platformUser.count(),
      prisma.platformUser.count({ where: { isActive: true } }),
      prisma.auditLog.count({ where: { timestamp: { gte: last24h } } }),
    ]);

  const recentLogs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 10,
    include: { actor: { select: { name: true, email: true } } },
  });

  return { totalTenants, activeTenants, suspendedTenants, totalUsers, activeUsers, recentAuditLogs, recentLogs };
}

export default async function OwnerDashboard() {
  const session = await getSession();
  if (!session?.user.platformRole) redirect("/403");

  const stats = await getStats();

  const statCards = [
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
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">דשבורד פלטפורמה</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl ${card.color} flex items-center justify-center`}>
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

      {/* Recent audit log */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">פעילות אחרונה</h2>
          <Link href="/owner/audit-logs" className="text-xs text-orange-500 hover:text-orange-600">
            הצג הכל ←
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {stats.recentLogs.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">אין פעילות עדיין</div>
          )}
          {stats.recentLogs.map((log) => (
            <div key={log.id} className="px-5 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {log.action}
                </span>
                {log.actor && (
                  <span className="ml-2 text-xs text-slate-500">{log.actor.email}</span>
                )}
                {log.targetType && (
                  <span className="ml-1 text-xs text-slate-400">→ {log.targetType} {log.targetId?.slice(0, 8)}</span>
                )}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
