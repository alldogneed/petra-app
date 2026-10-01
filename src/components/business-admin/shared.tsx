"use client";


import Link from "next/link";
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
  Undo2,
  Ban,
  Download,
  LogOut,
  ShieldCheck,
  UserCog,
  UserX,
  UserCheck,
  Link2,
  Unlink,
  RefreshCw,
  PawPrint,
  Pencil,
} from "lucide-react";
import { actionLabel, entityHref, DELETE_ACTIONS } from "@/lib/activity-actions";

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
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
}

export interface ActivityPage {
  items: ActivityEntry[];
  nextCursor: string | null;
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

// Hebrew action labels: actionLabel() from @/lib/activity-actions (single source of truth).

export const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LOGIN: LogIn,
  CREATE_CUSTOMER: Users,
  UPDATE_CUSTOMER: Pencil,
  DELETE_CUSTOMER: Trash2,
  ADD_PET: PawPrint,
  DELETE_PET: Trash2,
  CREATE_APPOINTMENT: Calendar,
  UPDATE_APPOINTMENT: Calendar,
  COMPLETE_APPOINTMENT: CheckCircle2,
  CANCEL_APPOINTMENT: XCircle,
  DELETE_APPOINTMENT: Trash2,
  CREATE_ORDER: Package,
  CANCEL_ORDER: XCircle,
  DELETE_ORDER: Trash2,
  CREATE_PAYMENT: CreditCard,
  UPDATE_PAYMENT: CreditCard,
  CANCEL_PAYMENT: Ban,
  REFUND_PAYMENT: Undo2,
  DELETE_PAYMENT: Trash2,
  CREATE_LEAD: Target,
  UPDATE_LEAD: Target,
  CLOSE_LEAD_WON: CheckCircle2,
  CLOSE_LEAD_LOST: XCircle,
  DELETE_LEAD: Trash2,
  CREATE_TASK: ListTodo,
  COMPLETE_TASK: CheckCircle2,
  CANCEL_TASK: XCircle,
  DELETE_TASK: Trash2,
  CREATE_BOARDING_STAY: Hotel,
  CHECKIN_BOARDING: Hotel,
  CHECKOUT_BOARDING: Hotel,
  DELETE_BOARDING: Trash2,
  DELETE_TRAINING: Trash2,
  UPDATE_SETTINGS: Settings,
  CREATE_MESSAGE_TEMPLATE: MessageSquare,
  EXPORT_CUSTOMERS: Download,
  EXPORT_DATA: Download,
  EXPORT_ACTIVITY: Download,
  CONNECT_WHATSAPP: Link2,
  DISCONNECT_WHATSAPP: Unlink,
  SYNC_WHATSAPP_TEMPLATES: RefreshCw,
  UPDATE_MEMBER_ROLE: UserCog,
  UPDATE_MEMBER_PERMISSIONS: UserCog,
  DEACTIVATE_MEMBER: UserX,
  ACTIVATE_MEMBER: UserCheck,
  REVOKE_SESSION: LogOut,
  UPDATE_SECURITY_ALERTS: ShieldCheck,
};

const RED = "#EF4444";
const ORANGE = "#F97316";
const GREEN = "#10B981";
const SLATE = "#64748B";

export const ACTION_COLORS: Record<string, string> = {
  LOGIN: "#22C55E",
  CREATE_CUSTOMER: "#06B6D4",
  UPDATE_CUSTOMER: "#06B6D4",
  DELETE_CUSTOMER: RED,
  ADD_PET: "#A855F7",
  DELETE_PET: RED,
  CREATE_APPOINTMENT: "#3B82F6",
  UPDATE_APPOINTMENT: "#3B82F6",
  COMPLETE_APPOINTMENT: GREEN,
  CANCEL_APPOINTMENT: ORANGE,
  DELETE_APPOINTMENT: RED,
  CREATE_ORDER: "#F59E0B",
  CANCEL_ORDER: ORANGE,
  DELETE_ORDER: RED,
  CREATE_PAYMENT: GREEN,
  UPDATE_PAYMENT: GREEN,
  CANCEL_PAYMENT: RED,
  REFUND_PAYMENT: ORANGE,
  DELETE_PAYMENT: RED,
  CREATE_LEAD: "#EC4899",
  UPDATE_LEAD: "#EC4899",
  CLOSE_LEAD_WON: GREEN,
  CLOSE_LEAD_LOST: RED,
  DELETE_LEAD: RED,
  CREATE_TASK: "#6366F1",
  COMPLETE_TASK: GREEN,
  CANCEL_TASK: ORANGE,
  DELETE_TASK: RED,
  CREATE_BOARDING_STAY: ORANGE,
  CHECKIN_BOARDING: ORANGE,
  CHECKOUT_BOARDING: ORANGE,
  DELETE_BOARDING: RED,
  DELETE_TRAINING: RED,
  UPDATE_SETTINGS: SLATE,
  CREATE_MESSAGE_TEMPLATE: "#8B5CF6",
  EXPORT_CUSTOMERS: "#0EA5E9",
  EXPORT_DATA: "#0EA5E9",
  EXPORT_ACTIVITY: "#0EA5E9",
  CONNECT_WHATSAPP: "#22C55E",
  DISCONNECT_WHATSAPP: ORANGE,
  SYNC_WHATSAPP_TEMPLATES: "#22C55E",
  UPDATE_MEMBER_ROLE: "#8B5CF6",
  UPDATE_MEMBER_PERMISSIONS: "#8B5CF6",
  DEACTIVATE_MEMBER: RED,
  ACTIVATE_MEMBER: GREEN,
  REVOKE_SESSION: ORANGE,
  UPDATE_SECURITY_ALERTS: SLATE,
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

/** Action icon in a tinted square (shared by ActivityRow and the activity table). */
export function ActionIcon({ action, size = "md" }: { action: string; size?: "sm" | "md" }) {
  const color = ACTION_COLORS[action] ?? SLATE;
  const Icon = ACTION_ICONS[action] ?? Activity;
  const box = size === "sm" ? "w-6 h-6 rounded-md" : "w-7 h-7 rounded-lg";
  const icon = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className={`${box} flex items-center justify-center flex-shrink-0`} style={{ background: color + "18" }}>
      <Icon className={icon} {...({ style: { color } } as any)} />
    </div>
  );
}

/** The entity label — a link when the entity still has a page, plain text otherwise. */
export function EntityLabel({ entry }: { entry: ActivityEntry }) {
  if (!entry.entityLabel) return null;
  const href = entityHref(entry.entityType, entry.entityId, DELETE_ACTIONS.has(entry.action));
  return href ? (
    <Link href={href} className="text-sm font-medium text-brand-600 hover:underline break-words">
      {entry.entityLabel}
    </Link>
  ) : (
    <span className="text-sm font-medium text-slate-700 break-words">{entry.entityLabel}</span>
  );
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <ActionIcon action={entry.action} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800">{entry.userName}</span>
        <span className="text-sm text-petra-muted"> {actionLabel(entry.action)} </span>
        <EntityLabel entry={entry} />
      </div>
      <span className="text-xs text-petra-muted flex-shrink-0 whitespace-nowrap" title={formatTs(entry.createdAt)}>
        {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}
