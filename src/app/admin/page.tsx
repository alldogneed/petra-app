"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, UserPlus, Activity, Clock, Zap, ShieldOff, BarChart2 } from "lucide-react";
import Link from "next/link";

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
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
}

function getScoreStyle(score: number): React.CSSProperties {
  if (score >= 20) return { background: "#06B6D420", color: "#06B6D4" };
  if (score >= 10) return { background: "#F59E0B20", color: "#F59E0B" };
  if (score >= 1)  return { background: "#64748B20", color: "#94A3B8" };
  return { background: "#EF444420", color: "#EF4444" };
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/admin/users?limit=8").then((r) => r.json()),
  });

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["admin-feed"],
    queryFn: () => fetch("/api/admin/feed?limit=20").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const kpis = [
    { icon: <Users className="w-4 h-4" />, label: "סה״כ משתמשים", value: stats?.totalUsers, sub: "רשומים", color: "#06B6D4" },
    { icon: <BarChart2 className="w-4 h-4" />, label: "MAU", value: stats?.mau, sub: "30 יום אחרונים", color: "#F97316" },
    { icon: <UserPlus className="w-4 h-4" />, label: "הרשמות חדשות", value: stats?.newSignups7d, sub: "7 ימים", color: "#A855F7" },
    { icon: <Zap className="w-4 h-4" />, label: "פעילים היום", value: stats?.activeToday, sub: "כניסות היום", color: "#22C55E" },
    { icon: <TrendingUp className="w-4 h-4" />, label: "פעילים חשבונות", value: stats?.activeUsers, sub: "חשבונות פעילים", color: "#3B82F6" },
    { icon: <ShieldOff className="w-4 h-4" />, label: "חסומים", value: stats?.blockedUsers, sub: "חשבונות חסומים", color: "#EF4444" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">דשבורד ראשי</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>סקירה כללית של הפלטפורמה</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px]" style={{ color: "#475569" }}>חי</span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-4" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: `${kpi.color}18` }}>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {statsLoading ? <span className="animate-pulse">—</span> : (kpi.value ?? "—")}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "#475569" }}>{kpi.sub}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "#334155" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: "/admin/users", label: "ניהול משתמשים", color: "#06B6D4" },
          { href: "/admin/stats", label: "סטטיסטיקות", color: "#F97316" },
          { href: "/admin/bookings", label: "ניהול הזמנות", color: "#A855F7" },
          { href: "/admin/feed", label: "פיד פעילות", color: "#22C55E" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl px-4 py-3 text-sm font-medium text-center transition-colors hover:opacity-90"
            style={{ background: `${l.color}12`, color: l.color, border: `1px solid ${l.color}20` }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Table + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Users Table */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #1E1E2E" }}>
            <h2 className="text-sm font-semibold text-white">משתמשים אחרונים</h2>
            <Link href="/admin/users" className="text-xs font-medium" style={{ color: "#06B6D4" }}>
              הצג הכל ←
            </Link>
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
                    {["שם", "עסק", "פעילות אחרונה", "ציון"].map((h) => (
                      <th key={h} className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((user: {
                    id: string; name: string; email: string; isActive: boolean;
                    businessName: string | null; lastActivityAt: string | null; activityScore: number;
                  }) => {
                    const sc = getScoreStyle(user.activityScore);
                    return (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid #1E1E2E", opacity: user.isActive ? 1 : 0.5 }}>
                        <td className="px-5 py-3">
                          <div className="text-sm text-white">{user.name}</div>
                          <div className="text-xs" style={{ color: "#64748B" }}>{user.email}</div>
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>{user.businessName || "—"}</td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {user.lastActivityAt ? relativeTime(user.lastActivityAt) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={sc}>
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

          <div className="max-h-[420px] overflow-y-auto">
            {feedLoading ? (
              <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
            ) : !feed?.length ? (
              <div className="p-8 text-center text-sm" style={{ color: "#64748B" }}>אין פעילות עדיין</div>
            ) : (
              feed.map((item: { id: string; action: string; userName: string; createdAt: string }) => (
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

          <div className="px-5 py-3" style={{ borderTop: "1px solid #1E1E2E" }}>
            <Link href="/admin/feed" className="text-xs" style={{ color: "#06B6D4" }}>
              צפה בפיד המלא ←
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
