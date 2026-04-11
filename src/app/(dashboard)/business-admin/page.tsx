"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TierGate } from "@/components/paywall/TierGate";
import {
  ShieldCheck,
  Users,
  Activity,
  Monitor,
  BarChart2,
  Clock,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  ChevronDown,
  RefreshCw,
  LogIn,
  Plus,
  PenLine,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  CreditCard,
  Package,
  Hotel,
  Target,
  ListTodo,
  MessageSquare,
  Settings,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────

interface OverviewData {
  teamCount: number;
  customerCount: number;
  todayAppts: number;
  monthlyRevenue: number;
  recentActivity: ActivityEntry[];
}

interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    createdAt: string;
    isActive: boolean;
    sessions: {
      lastSeenAt: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
    }[];
  };
}

interface SessionEntry {
  id: string;
  userId: string;
  businessRole: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ── Constants ────────────────────────────────────────────────────

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
  CREATE_TASK: "יצר משימה",
  COMPLETE_TASK: "השלים משימה",
  CANCEL_TASK: "ביטל משימה",
  CREATE_BOARDING_STAY: "יצר שהייה בפנסיון",
  CHECKIN_BOARDING: "ביצע צ׳ק-אין",
  CHECKOUT_BOARDING: "ביצע צ׳ק-אאוט",
  DELETE_BOARDING: "מחק שהייה",
  UPDATE_SETTINGS: "עדכן הגדרות",
  CREATE_MESSAGE_TEMPLATE: "יצר תבנית הודעה",
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LOGIN: LogIn,
  CREATE_CUSTOMER: Users,
  UPDATE_CUSTOMER: Users,
  DELETE_CUSTOMER: Trash2,
  ADD_PET: Package,
  CREATE_APPOINTMENT: Calendar,
  UPDATE_APPOINTMENT: Calendar,
  COMPLETE_APPOINTMENT: CheckCircle2,
  CANCEL_APPOINTMENT: XCircle,
  DELETE_APPOINTMENT: Trash2,
  CREATE_ORDER: Package,
  CREATE_PAYMENT: CreditCard,
  CREATE_LEAD: Target,
  UPDATE_LEAD: Target,
  CLOSE_LEAD_WON: CheckCircle2,
  CLOSE_LEAD_LOST: XCircle,
  CREATE_TASK: ListTodo,
  COMPLETE_TASK: CheckCircle2,
  CANCEL_TASK: XCircle,
  CREATE_BOARDING_STAY: Hotel,
  UPDATE_SETTINGS: Settings,
  CREATE_MESSAGE_TEMPLATE: MessageSquare,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "#22C55E",
  CREATE_CUSTOMER: "#06B6D4",
  UPDATE_CUSTOMER: "#06B6D4",
  DELETE_CUSTOMER: "#EF4444",
  ADD_PET: "#A855F7",
  CREATE_APPOINTMENT: "#3B82F6",
  COMPLETE_APPOINTMENT: "#10B981",
  CANCEL_APPOINTMENT: "#F97316",
  DELETE_APPOINTMENT: "#EF4444",
  CREATE_ORDER: "#F59E0B",
  CREATE_PAYMENT: "#10B981",
  CREATE_LEAD: "#EC4899",
  UPDATE_LEAD: "#EC4899",
  CLOSE_LEAD_WON: "#10B981",
  CLOSE_LEAD_LOST: "#EF4444",
  CREATE_TASK: "#6366F1",
  COMPLETE_TASK: "#10B981",
  CREATE_BOARDING_STAY: "#F97316",
  UPDATE_SETTINGS: "#64748B",
  CREATE_MESSAGE_TEMPLATE: "#8B5CF6",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  manager: "מנג׳ר",
  user: "עובד",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  user: "bg-slate-100 text-slate-700",
};

// ── Helpers ──────────────────────────────────────────────────────

function relativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שע׳`;
  return `לפני ${Math.floor(diffHr / 24)} ימים`;
}

function formatTs(date: string) {
  return new Date(date).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDevice(ua: string | null) {
  if (!ua) return "לא ידוע";
  if (/iPhone|iPad/.test(ua)) return "iPhone / iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "דפדפן";
}

function isOnline(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000; // 5 min
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const sizeClass = `w-${size} h-${size}`;
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
      style={{ background: "linear-gradient(135deg, #F97316, #FB923C)" }}
    >
      {getInitials(name)}
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  const color = ACTION_COLORS[entry.action] ?? "#64748B";
  const Icon = ACTION_ICONS[entry.action] ?? Activity;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color + "18" }}
      >
        <Icon className="w-3.5 h-3.5" {...({ style: { color } } as any)} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800">{entry.userName}</span>
        <span className="text-sm text-petra-muted"> · {label}</span>
      </div>
      <span className="text-xs text-petra-muted flex-shrink-0 whitespace-nowrap">
        {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────

function OverviewTab() {
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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
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

function ActivityTab() {
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const { data: teamData } = useQuery<TeamMember[]>({
    queryKey: ["ba-team"],
    queryFn: () => fetch("/api/business-admin/team").then((r) => r.json()),
  });

  const params = new URLSearchParams({ take: "100" });
  if (filterUser) params.set("userId", filterUser);
  if (filterAction) params.set("action", filterAction);

  const { data, isLoading, refetch, isFetching } = useQuery<ActivityEntry[]>({
    queryKey: ["ba-activity", filterUser, filterAction],
    queryFn: () =>
      fetch(`/api/business-admin/activity?${params}`).then((r) => r.json()),
  });

  const actionOptions = [
    { value: "", label: "כל הפעולות" },
    { value: "LOGIN", label: "כניסות" },
    { value: "CREATE_CUSTOMER", label: "יצירת לקוח" },
    { value: "CREATE_APPOINTMENT", label: "יצירת תור" },
    { value: "CREATE_PAYMENT", label: "רישום תשלום" },
    { value: "CREATE_LEAD", label: "יצירת ליד" },
    { value: "CREATE_TASK", label: "יצירת משימה" },
    { value: "CREATE_BOARDING_STAY", label: "פנסיון" },
    { value: "UPDATE_SETTINGS", label: "הגדרות" },
    { value: "DELETE_CUSTOMER", label: "מחיקת לקוח" },
    { value: "DELETE_APPOINTMENT", label: "מחיקת תור" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input py-2 text-sm w-48"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
        >
          <option value="">כל חברי הצוות</option>
          {teamData?.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
        <select
          className="input py-2 text-sm w-48"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          {actionOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => refetch()}
          className="btn-ghost text-sm flex items-center gap-1.5 px-3"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          רענן
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="p-10 text-center text-sm text-petra-muted">
            אין פעילות להצגה
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-petra-muted">
                <th className="text-right px-4 py-3 font-medium">משתמש</th>
                <th className="text-right px-4 py-3 font-medium">פעולה</th>
                <th className="text-right px-4 py-3 font-medium">זמן</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => {
                const color = ACTION_COLORS[entry.action] ?? "#64748B";
                const Icon = ACTION_ICONS[entry.action] ?? Activity;
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {entry.userName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: color + "18" }}
                        >
                          <Icon className="w-3 h-3" {...({ style: { color } } as any)} />
                        </div>
                        <span className="text-slate-700">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-petra-muted whitespace-nowrap">
                      <span title={formatTs(entry.createdAt)}>
                        {relativeTime(entry.createdAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TeamTab({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["ba-team"],
    queryFn: () => fetch("/api/business-admin/team").then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/business-admin/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ba-team"] });
      queryClient.invalidateQueries({ queryKey: ["ba-overview"] });
      setEditingId(null);
      toast.success("עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  const handleRoleSave = (memberId: string) => {
    if (newRole) updateMutation.mutate({ id: memberId, data: { role: newRole } });
    setEditingId(null);
  };

  const handleToggleActive = (member: TeamMember) => {
    updateMutation.mutate({
      id: member.id,
      data: { isActive: !member.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="card p-6 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs text-petra-muted">
            <th className="text-right px-4 py-3 font-medium">משתמש</th>
            <th className="text-right px-4 py-3 font-medium">תפקיד</th>
            <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
              פעילות אחרונה
            </th>
            <th className="text-right px-4 py-3 font-medium">סטטוס</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {members?.map((member) => {
            const isMe = member.userId === currentUserId;
            const latestSession = member.user.sessions[0];
            const online = latestSession ? isOnline(latestSession.lastSeenAt) : false;

            return (
              <tr
                key={member.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                {/* User */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar name={member.user.name} url={member.user.avatarUrl} size={8} />
                      {online && (
                        <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {member.user.name}
                        {isMe && (
                          <span className="text-xs text-petra-muted font-normal"> (אתה)</span>
                        )}
                      </p>
                      <p className="text-xs text-petra-muted">{member.user.email}</p>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  {editingId === member.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="input py-1 text-xs"
                        defaultValue={member.role}
                        onChange={(e) => setNewRole(e.target.value)}
                        autoFocus
                      >
                        <option value="owner">בעלים</option>
                        <option value="manager">מנג׳ר</option>
                        <option value="user">עובד</option>
                      </select>
                      <button
                        onClick={() => handleRoleSave(member.id)}
                        className="text-green-600 hover:text-green-700"
                        title="שמור"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-400 hover:text-slate-600"
                        title="בטל"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        ROLE_COLORS[member.role] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  )}
                </td>

                {/* Last seen */}
                <td className="px-4 py-3 text-petra-muted hidden sm:table-cell">
                  {latestSession ? (
                    <span title={formatTs(latestSession.lastSeenAt)}>
                      {relativeTime(latestSession.lastSeenAt)}
                    </span>
                  ) : (
                    <span className="text-slate-300">מעולם לא</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      member.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {member.isActive ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        פעיל
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        מושבת
                      </>
                    )}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  {!isMe && (
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => {
                          setEditingId(member.id);
                          setNewRole(member.role);
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="שנה תפקיד"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(member)}
                        disabled={updateMutation.isPending}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          member.isActive
                            ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                            : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title={member.isActive ? "השבת משתמש" : "הפעל משתמש"}
                      >
                        {member.isActive ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SessionsTab({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<SessionEntry[]>({
    queryKey: ["ba-sessions"],
    queryFn: () => fetch("/api/business-admin/sessions").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-petra-muted">
          סשנים פעילים מתרענן כל 30 שניות
        </p>
        <button
          onClick={() => refetch()}
          className="btn-ghost text-sm flex items-center gap-1.5 px-3"
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          רענן
        </button>
      </div>

      {isLoading ? (
        <div className="card p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="card p-10 text-center">
          <WifiOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-petra-muted">אין סשנים פעילים כרגע</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-petra-muted">
                <th className="text-right px-4 py-3 font-medium">משתמש</th>
                <th className="text-right px-4 py-3 font-medium">תפקיד</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                  מכשיר
                </th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
                  IP
                </th>
                <th className="text-right px-4 py-3 font-medium">נראה לאחרונה</th>
                <th className="text-right px-4 py-3 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {data.map((session) => {
                const online = isOnline(session.lastSeenAt);
                const isMySession = session.userId === currentUserId;
                return (
                  <tr
                    key={session.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={session.user.name}
                          url={session.user.avatarUrl}
                          size={8}
                        />
                        <div>
                          <p className="font-medium text-slate-800">
                            {session.user.name}
                            {isMySession && (
                              <span className="text-xs text-petra-muted font-normal">
                                {" "}
                                (אתה)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-petra-muted">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          ROLE_COLORS[session.businessRole] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ROLE_LABELS[session.businessRole] ?? session.businessRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-petra-muted hidden md:table-cell">
                      {parseDevice(session.userAgent)}
                    </td>
                    <td className="px-4 py-3 text-petra-muted text-xs hidden lg:table-cell">
                      {session.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-petra-muted whitespace-nowrap">
                      <span title={formatTs(session.lastSeenAt)}>
                        {relativeTime(session.lastSeenAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          online
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {online ? (
                          <>
                            <Wifi className="w-3 h-3" />
                            מחובר
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            לא פעיל
                          </>
                        )}
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
  );
}

// ── System Messages Tab ───────────────────────────────────────────

interface SystemMsg {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  actionUrl?: string | null;
  actionLabel?: string | null;
  isRead: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

const MSG_TYPE_LABELS: Record<string, string> = {
  info: "מידע",
  warning: "אזהרה",
  success: "הצלחה",
  error: "שגיאה",
};
const MSG_TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-700",
};

const EMPTY_FORM = { title: "", content: "", type: "info" as const, actionUrl: "", actionLabel: "", expiresAt: "" };

function SystemMessagesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ messages: SystemMsg[] }>({
    queryKey: ["system-messages-admin"],
    queryFn: () => fetch("/api/system-messages?all=true").then((r) => r.json()),
    staleTime: 10000,
  });
  const messages = data?.messages ?? [];

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        content: form.content,
        type: form.type,
        actionUrl: form.actionUrl || null,
        actionLabel: form.actionLabel || null,
        expiresAt: form.expiresAt || null,
      };
      if (editingId) {
        return fetch(`/api/system-messages/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json());
      }
      return fetch("/api/system-messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-messages-admin"] });
      qc.invalidateQueries({ queryKey: ["systemMessages"] });
      toast.success(editingId ? "הודעה עודכנה" : "הודעה נוצרה");
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: () => toast.error("שגיאה בשמירה"),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/system-messages/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-messages-admin"] });
      qc.invalidateQueries({ queryKey: ["systemMessages"] });
      toast.success("הודעה נמחקה");
      setConfirmDeleteId(null);
    },
    onError: () => toast.error("שגיאה במחיקה"),
  });

  function startEdit(msg: SystemMsg) {
    setEditingId(msg.id);
    setForm({
      title: msg.title,
      content: msg.content,
      type: msg.type as typeof EMPTY_FORM.type,
      actionUrl: msg.actionUrl ?? "",
      actionLabel: msg.actionLabel ?? "",
      expiresAt: msg.expiresAt ? msg.expiresAt.slice(0, 16) : "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-petra-muted">{messages.length} הודעות במערכת</p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            הודעה חדשה
          </button>
        )}
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-slate-50 border border-petra-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-petra-text">
            {editingId ? "עריכת הודעה" : "הודעה חדשה"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <input
                placeholder="כותרת *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input w-full text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <textarea
                placeholder="תוכן ההודעה *"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={3}
                className="input w-full text-sm resize-none"
              />
            </div>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}
              className="input text-sm"
            >
              <option value="info">מידע</option>
              <option value="warning">אזהרה</option>
              <option value="success">הצלחה</option>
              <option value="error">שגיאה</option>
            </select>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="input text-sm"
              placeholder="תפוגה (אופציונלי)"
            />
            <input
              placeholder="כתובת קישור (אופציונלי)"
              value={form.actionUrl}
              onChange={(e) => setForm((f) => ({ ...f, actionUrl: e.target.value }))}
              className="input text-sm"
              dir="ltr"
            />
            <input
              placeholder="טקסט לכפתור (אופציונלי)"
              value={form.actionLabel}
              onChange={(e) => setForm((f) => ({ ...f, actionLabel: e.target.value }))}
              className="input text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={!form.title || !form.content || save.isPending}
              className="btn-primary text-sm gap-1.5"
            >
              {save.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {editingId ? "שמור שינויים" : "צור הודעה"}
            </button>
            <button onClick={cancelForm} className="btn-secondary text-sm">
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="bg-white border border-petra-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-petra-muted">אין הודעות מערכת</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-petra-muted w-20">סוג</th>
                <th className="text-right px-4 py-3 font-medium text-petra-muted">כותרת / תוכן</th>
                <th className="text-right px-4 py-3 font-medium text-petra-muted hidden sm:table-cell w-28">תאריך</th>
                <th className="text-right px-4 py-3 font-medium text-petra-muted hidden md:table-cell w-24">סטטוס</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => {
                const isExpired = msg.expiresAt && new Date(msg.expiresAt) < new Date();
                return (
                  <tr key={msg.id} className={`border-b border-slate-50 last:border-0 ${isExpired ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${MSG_TYPE_COLORS[msg.type]}`}>
                        {MSG_TYPE_LABELS[msg.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-petra-text truncate max-w-xs">{msg.title}</p>
                      <p className="text-[11px] text-petra-muted truncate max-w-xs mt-0.5">{msg.content}</p>
                    </td>
                    <td className="px-4 py-3 text-petra-muted text-xs hidden sm:table-cell">
                      {new Date(msg.createdAt).toLocaleDateString("he-IL")}
                      {isExpired && <span className="block text-red-400">פג תוקף</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${msg.isRead ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand-600 font-medium"}`}>
                        {msg.isRead ? "נקרא" : "לא נקרא"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {confirmDeleteId === msg.id ? (
                          <>
                            <button
                              onClick={() => del.mutate(msg.id)}
                              className="text-[11px] text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors"
                            >
                              מחק
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-petra-muted hover:text-petra-text px-2 py-1 rounded-lg transition-colors"
                            >
                              ביטול
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(msg)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="ערוך"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(msg.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="מחק"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────

interface SubscriptionEvent {
  id: string;
  eventType: string;
  tier: string | null;
  cardcomDealId: string | null;
  amount: number | null;
  createdAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  activate: "הפעלת מנוי", renew: "חידוש מנוי", cancel: "ביטול", expired: "פקיעה", error: "שגיאה",
};
const EVENT_TYPE_COLORS: Record<string, string> = {
  activate: "text-emerald-600 bg-emerald-50",
  renew: "text-blue-600 bg-blue-50",
  cancel: "text-amber-600 bg-amber-50",
  expired: "text-red-500 bg-red-50",
  error: "text-red-600 bg-red-50",
};
const TIER_LABELS_MAP: Record<string, string> = {
  free: "חינמי", basic: "בייסיק", pro: "פרו", groomer: "גרומר+", service_dog: "Service Dog",
};

function BillingTab() {
  const { subscriptionEndsAt, subscriptionActive, subscriptionExpired, subscriptionDaysLeft, tier } = usePlan();
  const { data: events = [], isLoading } = useQuery<SubscriptionEvent[]>({
    queryKey: ["billing-events"],
    queryFn: () => fetch("/api/billing/events").then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-petra-text mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-500" />מצב המנוי הנוכחי
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "מסלול", value: TIER_LABELS_MAP[tier] ?? tier },
            { label: "סטטוס", value: subscriptionExpired ? "פג תוקף" : subscriptionActive ? "פעיל" : "לא פעיל",
              className: subscriptionExpired ? "text-red-500" : subscriptionActive ? "text-emerald-600" : "text-slate-400" },
            { label: "תוקף עד", value: subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString("he-IL") : "—" },
            { label: "ימים נותרים", value: subscriptionActive ? String(subscriptionDaysLeft) : "—",
              className: subscriptionDaysLeft <= 7 ? "text-amber-500" : "" },
          ].map(({ label, value, className }) => (
            <div key={label} className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-petra-muted mb-1">{label}</p>
              <p className={`font-bold text-sm ${className ?? "text-petra-text"}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <a href="/upgrade" className="btn-primary text-sm gap-2 inline-flex">
            <CreditCard className="w-4 h-4" />
            {subscriptionActive ? "שנה מסלול" : "רכוש מנוי"}
          </a>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-petra-border">
          <h3 className="font-semibold text-petra-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-500" />היסטוריית עסקאות
          </h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-petra-muted text-sm">אין עסקאות עדיין</div>
        ) : (
          <div className="divide-y divide-petra-border">
            {events.map((ev) => (
              <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EVENT_TYPE_COLORS[ev.eventType] ?? "text-slate-600 bg-slate-50"}`}>
                    {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
                  </span>
                  {ev.tier && <span className="text-sm text-petra-text">{TIER_LABELS_MAP[ev.tier] ?? ev.tier}</span>}
                  {ev.cardcomDealId && <span className="text-xs text-petra-muted">עסקה #{ev.cardcomDealId}</span>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {ev.amount != null && ev.amount > 0 && <span className="text-sm font-semibold text-emerald-600">₪{ev.amount}</span>}
                  <span className="text-xs text-petra-muted">{new Date(ev.createdAt).toLocaleDateString("he-IL")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

type Tab = "overview" | "activity" | "team" | "sessions" | "messages" | "billing";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "סקירה", icon: BarChart2 },
  { id: "activity", label: "פעילות", icon: Activity },
  { id: "team", label: "צוות", icon: Users },
  { id: "sessions", label: "סשנים", icon: Monitor },
  { id: "messages", label: "הודעות מערכת", icon: MessageSquare },
  { id: "billing", label: "מנוי וחיוב", icon: CreditCard },
];

function BusinessAdminPageContent() {
  const { user, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (!isOwner && user?.businessRole !== "admin") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-700">גישה מוגבלת</h2>
          <p className="text-sm text-petra-muted">
            דף זה זמין לבעלי עסק ומנהלים בלבד.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-500" />
            ניהול ובקרה
          </h1>
          <p className="text-sm text-petra-muted mt-0.5">
            פיקוח על פעילות המשתמשים וניהול הצוות
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-petra-muted bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span
              className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
            />
            ניטור פעיל
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-max md:w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {tab.label}
            </button>
          );
        })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "activity" && <ActivityTab />}
      {activeTab === "team" && <TeamTab currentUserId={user?.id ?? ""} />}
      {activeTab === "sessions" && <SessionsTab currentUserId={user?.id ?? ""} />}
      {activeTab === "messages" && <SystemMessagesTab />}
      {activeTab === "billing" && <BillingTab />}
    </div>
  );
}

export default function BusinessAdminPage() {
  return (
    <TierGate
      feature="staff_management"
      title="ניהול צוות ומשתמשים"
      description="הוסף עובדים נוספים, נהל הרשאות, ועקוב אחר פעילות הצוות. זמין במסלול Pro ומעלה."
      upgradeTier="pro"
    >
      <BusinessAdminPageContent />
    </TierGate>
  );
}
