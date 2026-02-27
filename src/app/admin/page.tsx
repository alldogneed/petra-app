"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, UserPlus, Activity, Clock } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "התחבר למערכת",
  CREATE_CUSTOMER: "יצר לקוח חדש",
  UPDATE_CUSTOMER: "עדכן לקוח",
  DELETE_CUSTOMER: "מחק לקוח",
  ADD_PET: "הוסיף חיית מחמד",
  CREATE_APPOINTMENT: "יצר תור חדש",
  UPDATE_APPOINTMENT: "עדכן תור",
  COMPLETE_APPOINTMENT: "סיים תור",
  CANCEL_APPOINTMENT: "ביטל תור",
  DELETE_APPOINTMENT: "מחק תור",
  CREATE_ORDER: "יצר הזמנה חדשה",
  CREATE_PAYMENT: "רשם תשלום",
  CREATE_LEAD: "יצר ליד חדש",
  UPDATE_LEAD: "עדכן ליד",
  CLOSE_LEAD_WON: "סגר ליד בהצלחה",
  CLOSE_LEAD_LOST: "סגר ליד כאבוד",
  DELETE_LEAD: "מחק ליד",
  CREATE_TASK: "יצר משימה חדשה",
  COMPLETE_TASK: "סיים משימה",
  CANCEL_TASK: "ביטל משימה",
  CREATE_BOARDING_STAY: "יצר שהייה בפנסיון",
  CHECKIN_BOARDING: "ביצע צ׳ק-אין בפנסיון",
  CHECKOUT_BOARDING: "ביצע צ׳ק-אאוט מפנסיון",
  DELETE_BOARDING: "מחק שהייה בפנסיון",
  UPDATE_SETTINGS: "עדכן הגדרות",
  CREATE_MESSAGE_TEMPLATE: "יצר תבנית הודעה",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "#22C55E",
  CREATE_CUSTOMER: "#06B6D4",
  UPDATE_CUSTOMER: "#0891B2",
  DELETE_CUSTOMER: "#EF4444",
  ADD_PET: "#A855F7",
  CREATE_APPOINTMENT: "#3B82F6",
  UPDATE_APPOINTMENT: "#2563EB",
  COMPLETE_APPOINTMENT: "#10B981",
  CANCEL_APPOINTMENT: "#F59E0B",
  DELETE_APPOINTMENT: "#EF4444",
  CREATE_ORDER: "#F59E0B",
  CREATE_PAYMENT: "#10B981",
  CREATE_LEAD: "#EC4899",
  UPDATE_LEAD: "#DB2777",
  CLOSE_LEAD_WON: "#10B981",
  CLOSE_LEAD_LOST: "#EF4444",
  DELETE_LEAD: "#EF4444",
  CREATE_TASK: "#6366F1",
  COMPLETE_TASK: "#10B981",
  CANCEL_TASK: "#F59E0B",
  CREATE_BOARDING_STAY: "#F97316",
  CHECKIN_BOARDING: "#22C55E",
  CHECKOUT_BOARDING: "#06B6D4",
  DELETE_BOARDING: "#EF4444",
  UPDATE_SETTINGS: "#64748B",
  CREATE_MESSAGE_TEMPLATE: "#8B5CF6",
};

function relativeTime(date: string) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שעות`;
  const diffDays = Math.floor(diffHr / 24);
  return `לפני ${diffDays} ימים`;
}

function getScoreColor(score: number) {
  if (score >= 20) return { bg: "#06B6D420", text: "#06B6D4" };
  if (score >= 10) return { bg: "#F59E0B20", text: "#F59E0B" };
  if (score >= 1) return { bg: "#64748B20", text: "#94A3B8" };
  return { bg: "#EF444420", text: "#EF4444" };
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json()),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users?limit=10").then((r) => r.json()),
  });

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["admin-feed"],
    queryFn: () => fetch("/api/admin/feed?limit=20").then((r) => r.json()),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">דשבורד ראשי</h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>סקירה כללית של הפלטפורמה</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="סה״כ משתמשים"
          value={stats?.totalUsers ?? "—"}
          subtitle="משתמשים פעילים"
          loading={statsLoading}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="משתמשים פעילים חודשיים"
          value={stats?.mau ?? "—"}
          subtitle="30 ימים אחרונים"
          loading={statsLoading}
        />
        <StatCard
          icon={<UserPlus className="w-5 h-5" />}
          label="הרשמות חדשות"
          value={stats?.newSignups7d ?? "—"}
          subtitle="7 ימים אחרונים"
          loading={statsLoading}
        />
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Users Table */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <h2 className="text-sm font-semibold text-white">משתמשים</h2>
            <a href="/admin/users" className="text-xs font-medium" style={{ color: "#06B6D4" }}>
              הצג הכל ←
            </a>
          </div>

          {usersLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
          ) : !usersData?.users?.length ? (
            <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>אין משתמשים עדיין</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1E1E2E" }}>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>שם</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>עסק</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>פעילות אחרונה</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>ציון פעילות</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((user: any) => {
                    const sc = getScoreColor(user.activityScore);
                    return (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid #1E1E2E" }}>
                        <td className="px-5 py-3">
                          <div className="text-sm text-white">{user.name}</div>
                          <div className="text-xs" style={{ color: "#64748B" }}>{user.email}</div>
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {user.businessName || "—"}
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {user.lastActivityAt ? relativeTime(user.lastActivityAt) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            {user.activityScore}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: "#06B6D4" }} />
              <h2 className="text-sm font-semibold text-white">פיד חי</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px]" style={{ color: "#64748B" }}>עדכון אוטומטי</span>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {feedLoading ? (
              <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
            ) : !feed?.length ? (
              <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>אין פעילות עדיין</div>
            ) : (
              feed.map((item: any) => (
                <div
                  key={item.id}
                  className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: "1px solid #1E1E2E" }}
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: ACTION_COLORS[item.action] || "#64748B" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "#E2E8F0" }}>
                      <span className="font-medium text-white">{item.userName}</span>{" "}
                      {ACTION_LABELS[item.action] || item.action}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" style={{ color: "#475569" }} />
                      <span className="text-[11px]" style={{ color: "#475569" }}>
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(6, 182, 212, 0.1)" }}>
          <span style={{ color: "#06B6D4" }}>{icon}</span>
        </div>
      </div>
      <div className="text-3xl font-bold text-white">
        {loading ? <span className="animate-pulse">—</span> : value}
      </div>
      <div className="text-xs mt-1" style={{ color: "#64748B" }}>{subtitle}</div>
      <div className="text-[10px] mt-0.5" style={{ color: "#475569" }}>{label}</div>
    </div>
  );
}
