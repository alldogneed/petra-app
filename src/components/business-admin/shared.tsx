"use client";


import {
  Users,
  Activity,
  LogIn,
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

// ── Types ────────────────────────────────────────────────────────

export interface OverviewData {
  teamCount: number;
  customerCount: number;
  todayAppts: number;
  monthlyRevenue: number;
  recentActivity: ActivityEntry[];
}

export interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: string;
}

export interface TeamMember {
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

export interface SessionEntry {
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

export const ACTION_LABELS: Record<string, string> = {
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

export const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

export const ACTION_COLORS: Record<string, string> = {
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

export const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  manager: "מנג׳ר",
  user: "עובד",
};

export const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  user: "bg-slate-100 text-slate-700",
};

// ── Helpers ──────────────────────────────────────────────────────

export function relativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שע׳`;
  return `לפני ${Math.floor(diffHr / 24)} ימים`;
}

export function formatTs(date: string) {
  return new Date(date).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseDevice(ua: string | null) {
  if (!ua) return "לא ידוע";
  if (/iPhone|iPad/.test(ua)) return "iPhone / iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "דפדפן";
}

export function isOnline(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000; // 5 min
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────

export function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
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

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
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
