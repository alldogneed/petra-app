"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, UserPlus, ShieldOff, Zap, BarChart2 } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "כניסות למערכת",
  CREATE_CUSTOMER: "לקוחות חדשים",
  ADD_PET: "חיות מחמד",
  CREATE_APPOINTMENT: "תורים חדשים",
  CREATE_PAYMENT: "תשלומים",
  CREATE_LEAD: "לידים חדשים",
  CREATE_TASK: "משימות חדשות",
  CREATE_BOARDING_STAY: "שהיות פנסיון",
  UPDATE_SETTINGS: "עדכוני הגדרות",
  CREATE_MESSAGE_TEMPLATE: "תבניות הודעה",
  COMPLETE_APPOINTMENT: "תורים שהושלמו",
  CANCEL_APPOINTMENT: "תורים שבוטלו",
  CREATE_ORDER: "הזמנות",
  UPDATE_CUSTOMER: "עדכוני לקוח",
  CLOSE_LEAD_WON: "לידים שנסגרו",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "#22C55E",
  CREATE_CUSTOMER: "#06B6D4",
  ADD_PET: "#A855F7",
  CREATE_APPOINTMENT: "#3B82F6",
  CREATE_PAYMENT: "#10B981",
  CREATE_LEAD: "#EC4899",
  CREATE_TASK: "#6366F1",
  CREATE_BOARDING_STAY: "#F97316",
  UPDATE_SETTINGS: "#64748B",
  CREATE_MESSAGE_TEMPLATE: "#8B5CF6",
  COMPLETE_APPOINTMENT: "#10B981",
  CANCEL_APPOINTMENT: "#F59E0B",
  CREATE_ORDER: "#F59E0B",
  UPDATE_CUSTOMER: "#0891B2",
  CLOSE_LEAD_WON: "#10B981",
};

interface Stats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  mau: number;
  newSignups7d: number;
  activeToday: number;
  topUsers: Array<{ userId: string; userName: string; count: number }>;
  activityByAction: Array<{ action: string; count: number }>;
  dailyActivity: Array<{ date: string; count: number }>;
}

function StatCard({
  icon, label, value, sub, color = "#06B6D4",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#475569" }}>{sub}</div>}
      <div className="text-[10px] mt-1" style={{ color: "#334155" }}>{label}</div>
    </div>
  );
}

export default function AdminStatsPage() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats-full"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const maxDailyCount = stats
    ? Math.max(...stats.dailyActivity.map((d) => d.count), 1)
    : 1;

  const maxActionCount = stats?.activityByAction[0]?.count || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">סטטיסטיקות פלטפורמה</h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>ניתוח פעילות ומשתמשים · מתעדכן כל דקה</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="סה״כ משתמשים"
          value={isLoading ? "—" : (stats?.totalUsers ?? "—")}
          sub="כולל חסומים"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="משתמשים פעילים"
          value={isLoading ? "—" : (stats?.activeUsers ?? "—")}
          sub="חשבונות פעילים"
          color="#22C55E"
        />
        <StatCard
          icon={<ShieldOff className="w-4 h-4" />}
          label="חסומים"
          value={isLoading ? "—" : (stats?.blockedUsers ?? "—")}
          sub="חשבונות חסומים"
          color="#EF4444"
        />
        <StatCard
          icon={<BarChart2 className="w-4 h-4" />}
          label="MAU (30 יום)"
          value={isLoading ? "—" : (stats?.mau ?? "—")}
          sub="משתמשים פעילים חודשיים"
          color="#F97316"
        />
        <StatCard
          icon={<UserPlus className="w-4 h-4" />}
          label="הרשמות 7 ימים"
          value={isLoading ? "—" : (stats?.newSignups7d ?? "—")}
          sub="משתמשים חדשים"
          color="#A855F7"
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="פעילים היום"
          value={isLoading ? "—" : (stats?.activeToday ?? "—")}
          sub="כניסות היום"
          color="#06B6D4"
        />
      </div>

      {/* Daily activity chart + Top users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Daily Activity Bar Chart */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <h2 className="text-sm font-semibold text-white mb-4">פעילות יומית (14 יום אחרונים)</h2>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {stats?.dailyActivity.map((day) => {
                const pct = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
                const d = new Date(day.date);
                const label = d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#06B6D4" }}>
                      {day.count}
                    </div>
                    <div className="w-full rounded-t-sm transition-all" style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: pct > 50 ? "#06B6D4" : pct > 20 ? "#0891B2" : "#1E3A4A",
                    }} />
                    <div className="text-[9px] writing-vertical" style={{ color: "#334155" }}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Active Users */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <h2 className="text-sm font-semibold text-white">משתמשים פעילים ביותר</h2>
            <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>30 ימים אחרונים</p>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
          ) : !stats?.topUsers?.length ? (
            <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>אין נתונים</div>
          ) : (
            stats.topUsers.map((u, idx) => (
              <div key={u.userId} className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid #1E1E2E" }}>
                <span className="text-sm font-bold w-5 text-center" style={{ color: idx === 0 ? "#F59E0B" : "#334155" }}>
                  {idx + 1}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4" }}
                >
                  {(u.userName || "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{u.userName || "Unknown"}</div>
                  <div className="text-[10px]" style={{ color: "#475569" }}>{u.count} פעולות</div>
                </div>
                {/* Mini bar */}
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "#1E1E2E" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(u.count / (stats.topUsers[0]?.count || 1)) * 100}%`, background: "#06B6D4" }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Activity breakdown */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #1E1E2E" }}>
          <h2 className="text-sm font-semibold text-white">התפלגות פעולות</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>30 ימים אחרונים · טופ 10</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
        ) : !stats?.activityByAction?.length ? (
          <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>אין נתוני פעילות</div>
        ) : (
          <div className="p-5 space-y-3">
            {stats.activityByAction.map((item) => {
              const pct = Math.round((item.count / maxActionCount) * 100);
              const color = ACTION_COLORS[item.action] || "#64748B";
              return (
                <div key={item.action}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-sm" style={{ color: "#E2E8F0" }}>
                        {ACTION_LABELS[item.action] || item.action}
                      </span>
                    </div>
                    <span className="text-xs font-medium" style={{ color }}>{item.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#1E1E2E" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
