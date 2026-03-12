"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Menu,
  LogOut,
  Settings,
  Star,
  MessageCircle,
  Calendar,
  X,
  CreditCard,
  Users,
  UserPlus,
  ChevronDown,
  Bell,
  Mail,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  Send,
  ArrowRight,
  Info,
  Hotel,
  ListTodo,
  RefreshCw,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import dynamic from "next/dynamic";

const GlobalSearch = dynamic(
  () => import("@/components/search/global-search").then((m) => ({ default: m.GlobalSearch })),
  { ssr: false, loading: () => <div className="h-9 w-64 bg-slate-100 rounded-xl animate-pulse" /> }
);
import { cn, fetchJSON, formatCurrency, toWhatsAppPhone } from "@/lib/utils";
import { ReportBugButton } from "@/components/layout/ReportBugButton";

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/customers": { title: "לקוחות", subtitle: "ניהול בסיס הלקוחות" },
  "/calendar": { title: "יומן", subtitle: "תורים ופגישות" },
  "/leads": { title: "לידים", subtitle: "ניהול לקוחות פוטנציאליים" },
  "/messages": { title: "הודעות", subtitle: "תבניות ואוטומציות" },
  "/boarding": { title: "פנסיון", subtitle: "ניהול לינה וחיות" },
  "/settings": { title: "הגדרות", subtitle: "הגדרות העסק" },
  "/dashboard": { title: "דשבורד", subtitle: "סקירה כללית" },
  "/tasks": { title: "משימות", subtitle: "ניהול משימות תפעוליות" },
  "/training": { title: "אימונים", subtitle: "קבוצות ותוכניות אימון" },
  "/payments": { title: "תשלומים", subtitle: "ניהול תשלומים והכנסות" },
  "/bookings": { title: "ניהול תורים", subtitle: "ניהול תורים אונליין" },
  "/intake": { title: "טפסי קליטה", subtitle: "ניהול טפסי קליטה" },
  "/analytics": { title: "אנליטיקס", subtitle: "סטטיסטיקות ונתוני ביצוע" },
  "/orders": { title: "הזמנות", subtitle: "ניהול הזמנות" },
  "/payment-request": { title: "בקשת תשלום", subtitle: "שליחת בקשת תשלום ללקוח" },
  "/pricing": { title: "מחירון", subtitle: "ניהול מחירים" },
  "/scheduler": { title: "תורים", subtitle: "קביעת תורים ללקוחות" },
  "/service-dogs": { title: "כלבי שירות", subtitle: "ניהול כלבי שירות" },
  "/invoices": { title: "חשבוניות", subtitle: "ניהול חשבוניות ומסמכים" },
  "/automations": { title: "אוטומציות", subtitle: "הודעות אוטומטיות ללקוחות" },
  "/scheduled-messages": { title: "תור שליחה", subtitle: "הודעות מתוזמנות" },
  "/intake-forms": { title: "טפסי קליטה", subtitle: "ניהול טפסי קליטה ששלחת" },
  "/exports": { title: "ייצוא נתונים", subtitle: "הורד נתוני עסק לקובץ" },
  "/vaccinations": { title: "חיסונים", subtitle: "תזכורות חיסוני כלבת" },
  "/pets": { title: "חיות מחמד", subtitle: "כל החיות הרשומות בעסק" },
  "/medications": { title: "לוח תרופות", subtitle: "חיות עם תרופות פעילות" },
  "/feeding": { title: "לוח האכלה", subtitle: "מעקב האכלה יומי לחיות בפנסיון" },
  "/onboarding": { title: "הגדרת העסק", subtitle: "אשף הגדרה ראשוני" },
};

interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  icon: string;
}

interface DashboardSummary {
  monthRevenue: number;
  topService: { name: string; count: number } | null;
}

interface MemberUser {
  id: string;
  email: string;
  name: string;
  platformRole: string | null;
  isActive: boolean;
  createdAt: string;
  sessions: { lastSeenAt: string }[];
}

interface Member {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: MemberUser;
}

type PanelTab = "profile" | "users";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "צוות",
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "owner", label: "בעלים" },
  { value: "manager", label: "מנהל" },
  { value: "user", label: "צוות" },
];

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: "info" | "warning" | "success" | "error";
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface UpcomingAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;
  customer: { name: string };
  pet: { name: string; species: string } | null;
  service: { id: string; name: string; color: string; type: string } | null;
}

interface NotificationItem {
  id: string;
  kind: "system" | "appointment";
  text: string;
  subtext?: string;
  time: Date;
  timeLabel: string;
  isRead: boolean;
  color: string;
  systemMsgId?: string;
}

interface CustomerResult {
  id: string;
  name: string;
  phone: string;
  email?: string;
  pets?: { id: string; name: string; species: string }[];
}

interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  body: string;
}

function getRelativeTimeLabel(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  // Future dates (appointments)
  if (diffMs < 0) {
    const time = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    if (isToday) return `היום בשעה ${time}`;
    if (isTomorrow) return `מחר בשעה ${time}`;
    return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" }) + ` בשעה ${time}`;
  }

  // Past dates
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  if (diffHr < 24) return `לפני ${diffHr} שעות`;
  const time = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" }) + ` ${time}`;
}

function getNotifTypeColor(type: string): string {
  switch (type) {
    case "success": return "#22C55E";
    case "warning": return "#F59E0B";
    case "error": return "#EF4444";
    default: return "#3B82F6"; // info
  }
}

const NOTIF_TYPE_ICON: Record<string, typeof Info> = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle,
  error: AlertCircle,
};

interface BizNotifItem {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  critical: boolean;
  meta?: Record<string, unknown>;
}

function getBizNotifStyle(type: string): { color: string; Icon: typeof AlertCircle } {
  switch (type) {
    case "task_overdue": return { color: "#EF4444", Icon: AlertCircle };
    case "task_urgent":  return { color: "#F97316", Icon: ListTodo };
    case "payment":      return { color: "#F59E0B", Icon: CreditCard };
    case "appointment":  return { color: "#F97316", Icon: Calendar };
    case "boarding_checkin":
    case "boarding_checkout": return { color: "#3B82F6", Icon: Hotel };
    default:             return { color: "#94A3B8", Icon: Info };
  }
}

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("profile");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    name: "",
    role: "user",
    temporaryPassword: "",
  });
  const [inviteError, setInviteError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const notificationsRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, logout, isOwner } = useAuth();
  const queryClient = useQueryClient();

  // Close all panels/dropdowns on route change
  useEffect(() => {
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMessagesOpen(false);
  }, [pathname]);

  // Click-outside handler for notification and message dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
      if (
        messagesRef.current &&
        !messagesRef.current.contains(e.target as Node)
      ) {
        setMessagesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset tab when panel closes
  useEffect(() => {
    if (!profileOpen) {
      setActiveTab("profile");
      setShowInviteForm(false);
      setInviteError("");
    }
  }, [profileOpen]);

  // Integrations query — only when panel is open
  const { data: integrations } = useQuery<IntegrationStatus[]>({
    queryKey: ["integrations"],
    queryFn: () => fetchJSON("/api/integrations"),
    enabled: profileOpen && activeTab === "profile",
    staleTime: 60000,
  });

  // Dashboard summary — also used for notification appointments
  const { data: dashData } = useQuery<DashboardSummary & { upcomingAppointments: UpcomingAppointment[] }>({
    queryKey: ["dashboard"],
    queryFn: () => fetchJSON("/api/dashboard"),
    enabled: profileOpen && activeTab === "profile",
    staleTime: 30000,
  });

  // System messages — for mail/envelope icon (Petra platform announcements)
  const { data: sysMessagesData } = useQuery<{ messages: SystemMessage[]; unreadCount: number }>({
    queryKey: ["systemMessages"],
    queryFn: () => fetchJSON("/api/system-messages"),
    staleTime: 60000,
    refetchInterval: 120000,
  });
  const systemMessages = sysMessagesData?.messages ?? [];
  const unreadCount = sysMessagesData?.unreadCount ?? 0;

  // Business notifications — for bell icon (real-time critical business data)
  const { data: bizNotifsData } = useQuery<{ items: BizNotifItem[]; criticalCount: number }>({
    queryKey: ["biz-notifications"],
    queryFn: () => fetchJSON("/api/notifications"),
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const bizNotifications = bizNotifsData?.items ?? [];
  const criticalCount = bizNotifsData?.criticalCount ?? 0;

  // Mark system message as read
  const markAsRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/system-messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemMessages"] });
    },
  });

  // Mark all system messages as read
  const handleMarkAllRead = useCallback(async () => {
    const unread = systemMessages.filter((m) => !m.isRead);
    if (unread.length === 0) return;
    await Promise.all(
      unread.map((m) =>
        fetch(`/api/system-messages/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        })
      )
    );
    queryClient.invalidateQueries({ queryKey: ["systemMessages"] });
  }, [systemMessages, queryClient]);

  // Members query — only when users tab is active and user is owner
  const { data: members, isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: ["business-members", user?.businessId],
    queryFn: () => fetchJSON(`/api/admin/${user?.businessId}/members`),
    enabled: profileOpen && activeTab === "users" && isOwner && !!user?.businessId,
    staleTime: 30000,
  });

  // Update member mutation (role or active status)
  const updateMember = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { role?: string; isActive?: boolean } }) =>
      fetchJSON(`/api/admin/${user?.businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-members"] });
    },
  });

  // Invite member mutation
  const inviteMember = useMutation({
    mutationFn: (data: { email: string; name: string; role: string; temporaryPassword: string }) =>
      fetchJSON(`/api/admin/${user?.businessId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-members"] });
      setInviteData({ email: "", name: "", role: "user", temporaryPassword: "" });
      setShowInviteForm(false);
      setInviteError("");
    },
    onError: (err: Error) => {
      setInviteError(err.message);
    },
  });

  const pageKey = Object.keys(PAGE_TITLES).find((key) =>
    pathname.startsWith(key)
  );
  const pageInfo = pageKey ? PAGE_TITLES[pageKey] : null;

  const displayName = user?.name || "משתמש";
  const initials = displayName.charAt(0);
  const roleLabel =
    user?.platformRole === "super_admin"
      ? "מנהל על"
      : user?.platformRole === "admin"
      ? "מנהל מערכת"
      : user?.businessRole === "owner"
      ? "בעל עסק"
      : user?.businessRole === "manager"
      ? "מנהל"
      : "משתמש";

  const gcal = integrations?.find((i) => i.id === "google-calendar");
  const whatsapp = integrations?.find((i) => i.id === "whatsapp");

  return (
    <>
      <header
        className="sticky top-0 z-30 flex items-center h-16 px-4 md:px-6 gap-3 md:gap-4"
        style={{
          background: "rgba(248,250,252,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(226,232,240,0.8)",
        }}
      >
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuToggle}
          className="flex md:hidden items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="פתח תפריט"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title */}
        {pageInfo && (
          <div className="hidden md:flex flex-col min-w-0 ms-2">
            <span className="text-[15px] font-semibold text-petra-text leading-tight">
              {pageInfo.title}
            </span>
            {pageInfo.subtitle && (
              <span className="text-xs text-petra-muted leading-tight">
                {pageInfo.subtitle}
              </span>
            )}
          </div>
        )}

        {/* Search */}
        <div className="flex-1 min-w-0 max-w-[160px] sm:max-w-xs md:max-w-sm">
          <GlobalSearch />
        </div>

        {/* Notifications & Messages */}
        <div className="flex items-center gap-0.5 md:gap-1 ms-auto">

          {/* Refresh Button — hidden on mobile */}
          <button
            onClick={async () => {
              setIsRefreshing(true);
              await queryClient.invalidateQueries();
              setTimeout(() => setIsRefreshing(false), 600);
            }}
            disabled={isRefreshing}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="רענן נתונים"
            aria-label="רענן נתונים"
          >
            <RefreshCw className={`w-[18px] h-[18px] transition-transform ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Mail — Petra Platform Messages */}
          <div ref={messagesRef} className="relative">
            <button
              onClick={() => {
                setMessagesOpen((prev) => !prev);
                setNotificationsOpen(false);
              }}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="הודעות פטרה"
            >
              <Mail className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold px-1 ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Petra Messages Dropdown */}
            {messagesOpen && (
              <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:left-0 top-[68px] sm:top-full sm:mt-2 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-petra-text">הודעות מפטרה</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-brand-600 font-medium cursor-pointer hover:underline"
                    >
                      סמן הכל כנקרא
                    </button>
                  )}
                </div>
                <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
                  {systemMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Mail className="w-7 h-7 text-slate-300 mb-1.5" />
                      <p className="text-xs text-slate-400">אין הודעות חדשות מפטרה</p>
                    </div>
                  ) : (
                    systemMessages.map((msg) => {
                      const MsgIcon = NOTIF_TYPE_ICON[msg.type] ?? Info;
                      const color = getNotifTypeColor(msg.type);
                      return (
                        <div
                          key={msg.id}
                          onClick={() => { if (!msg.isRead) markAsRead.mutate(msg.id); }}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0",
                            !msg.isRead && "bg-brand-50/30 cursor-pointer"
                          )}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${color}18` }}
                          >
                            <MsgIcon className="w-3.5 h-3.5" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] text-petra-text leading-snug flex-1 truncate">{msg.title}</p>
                              {!msg.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />}
                            </div>
                            <p className="text-[11px] text-petra-muted mt-0.5 line-clamp-2">{msg.content}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {getRelativeTimeLabel(new Date(msg.createdAt))}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Business Notifications Bell */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => {
                setNotificationsOpen((prev) => !prev);
                setMessagesOpen(false);
              }}
              className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="התראות עסקיות"
            >
              <Bell className="w-[18px] h-[18px]" />
              {criticalCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-white">
                  {criticalCount}
                </span>
              )}
            </button>

            {/* Business Notifications Dropdown */}
            {notificationsOpen && (
              <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:left-0 top-[68px] sm:top-full sm:mt-2 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-petra-text">התראות עסקיות</h3>
                  {criticalCount > 0 && (
                    <p className="text-[11px] text-red-500 mt-0.5">{criticalCount} פריטים דורשים טיפול</p>
                  )}
                </div>
                <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
                  {bizNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <CheckCircle className="w-7 h-7 text-green-400 mb-1.5" />
                      <p className="text-xs text-slate-500 font-medium">הכל תקין!</p>
                      <p className="text-[11px] text-slate-400">אין התראות פעילות כרגע</p>
                    </div>
                  ) : (
                    bizNotifications.map((item) => {
                      const { color, Icon } = getBizNotifStyle(item.type);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0",
                            item.critical && "bg-red-50/40"
                          )}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: `${color}18` }}
                          >
                            <Icon className="w-3.5 h-3.5" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1.5">
                              <p className="text-[13px] text-petra-text leading-snug flex-1">{item.title}</p>
                              {item.critical && (
                                <span className="text-[10px] font-semibold text-red-500 flex-shrink-0 mt-0.5">⚠</span>
                              )}
                            </div>
                            <p className="text-[11px] text-petra-muted mt-0.5 truncate">{item.subtitle}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {bizNotifications.length > 0 && (
                  <div className="flex border-t border-slate-100">
                    <Link
                      href="/tasks"
                      onClick={() => setNotificationsOpen(false)}
                      className="flex-1 text-center py-2.5 text-xs font-medium text-brand-600 hover:bg-slate-50 transition-colors border-l border-slate-100"
                    >
                      משימות
                    </Link>
                    <Link
                      href="/calendar"
                      onClick={() => setNotificationsOpen(false)}
                      className="flex-1 text-center py-2.5 text-xs font-medium text-brand-600 hover:bg-slate-50 transition-colors border-l border-slate-100"
                    >
                      יומן
                    </Link>
                    <Link
                      href="/payments"
                      onClick={() => setNotificationsOpen(false)}
                      className="flex-1 text-center py-2.5 text-xs font-medium text-brand-600 hover:bg-slate-50 transition-colors"
                    >
                      תשלומים
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1 md:mx-2" />

          {/* User avatar */}
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-all duration-150 group"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
              }}
            >
              {initials}
            </div>
            <div className="hidden md:flex flex-col items-start">
              <span className="text-[13px] font-semibold text-petra-text leading-tight">
                {displayName}
              </span>
              <span className="text-[11px] text-petra-muted leading-tight">
                {roleLabel}
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* Profile Slide-out Panel */}
      {profileOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />

          {/* Panel - slides from left */}
          <div
            className={cn(
              "absolute top-0 left-0 h-full w-[320px] max-w-full bg-white shadow-2xl",
              "transition-transform duration-300 ease-out",
              "flex flex-col overflow-y-auto"
            )}
          >
            {/* Close button */}
            <button
              onClick={() => setProfileOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* User Info Header */}
            <div className="p-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-petra-text truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-petra-muted truncate">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-600">
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Tab Bar — only show tabs if owner */}
            {isOwner && (
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium transition-colors relative",
                    activeTab === "profile"
                      ? "text-brand-600"
                      : "text-petra-muted hover:text-petra-text"
                  )}
                >
                  פרופיל
                  {activeTab === "profile" && (
                    <span className="absolute bottom-0 inset-x-4 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("users")}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-1.5",
                    activeTab === "users"
                      ? "text-brand-600"
                      : "text-petra-muted hover:text-petra-text"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  בקרת משתמשים
                  {activeTab === "users" && (
                    <span className="absolute bottom-0 inset-x-4 h-0.5 bg-brand-500 rounded-full" />
                  )}
                </button>
              </div>
            )}

            {/* Profile Tab Content */}
            {activeTab === "profile" && (
              <>
                {/* System Health */}
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-petra-muted uppercase tracking-wider mb-3">
                    בריאות מערכת
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                      <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-petra-text flex-1">
                        Google Calendar
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            gcal?.connected ? "bg-green-500" : "bg-slate-300"
                          )}
                        />
                        <span className="text-[11px] text-petra-muted">
                          {gcal?.connected ? "מחובר" : "לא מחובר"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                      <MessageCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-petra-text flex-1">
                        WhatsApp
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            whatsapp?.connected ? "bg-green-500" : "bg-slate-300"
                          )}
                        />
                        <span className="text-[11px] text-petra-muted">
                          {whatsapp?.connected ? "פעיל" : "לא מוגדר"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Performance */}
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-petra-muted uppercase tracking-wider mb-3">
                    ביצועי עסק
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                      <CreditCard className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-petra-text flex-1">
                        הכנסות החודש
                      </span>
                      <span className="text-sm font-semibold text-petra-text">
                        {dashData
                          ? formatCurrency(dashData.monthRevenue)
                          : "—"}
                      </span>
                    </div>
                    {dashData?.topService && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                        <Star className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-petra-text flex-1">
                          שירות מוביל
                        </span>
                        <span className="text-sm font-medium text-brand-600">
                          {dashData.topService.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="p-5 mt-auto">
                  <div className="space-y-1">
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-petra-text hover:bg-slate-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      הגדרות
                    </Link>
                    <ReportBugButton menuMode />
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      התנתק
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Users Tab Content */}
            {activeTab === "users" && isOwner && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Members List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : !members?.length ? (
                    <div className="text-center py-8 text-sm text-petra-muted">
                      אין משתמשים
                    </div>
                  ) : (
                    members.map((member) => {
                      const isSelf = member.userId === user?.id;
                      const memberInitial = member.user.name?.charAt(0) || "?";
                      return (
                        <div
                          key={member.id}
                          className={cn(
                            "p-3 rounded-xl border transition-colors",
                            member.isActive
                              ? "border-slate-100 bg-white"
                              : "border-slate-100 bg-slate-50 opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div
                              className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
                                member.isActive ? "bg-slate-600" : "bg-slate-400"
                              )}
                            >
                              {memberInitial}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-petra-text truncate">
                                  {member.user.name}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] text-petra-muted">(את/ה)</span>
                                )}
                              </div>
                              <p className="text-[11px] text-petra-muted truncate">
                                {member.user.email}
                              </p>
                            </div>
                            {/* Role badge */}
                            <span
                              className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                                member.role === "owner"
                                  ? "bg-amber-50 text-amber-700"
                                  : member.role === "manager"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {ROLE_LABELS[member.role] || member.role}
                            </span>
                          </div>

                          {/* Actions — not for self */}
                          {!isSelf && (
                            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-50">
                              {/* Role selector */}
                              <div className="relative flex-1">
                                <select
                                  value={member.role}
                                  onChange={(e) =>
                                    updateMember.mutate({
                                      memberId: member.id,
                                      data: { role: e.target.value },
                                    })
                                  }
                                  className="w-full appearance-none text-xs bg-slate-50 border border-petra-border rounded-xl px-2.5 py-1.5 pr-7 text-petra-text cursor-pointer hover:border-slate-300 transition-colors"
                                >
                                  {ROLE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                              </div>
                              {/* Active toggle */}
                              <button
                                onClick={() =>
                                  updateMember.mutate({
                                    memberId: member.id,
                                    data: { isActive: !member.isActive },
                                  })
                                }
                                className={cn(
                                  "text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors",
                                  member.isActive
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-green-50 text-green-600 hover:bg-green-100"
                                )}
                              >
                                {member.isActive ? "השבת" : "הפעל"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Invite Member Section */}
                <div className="border-t border-slate-100 p-4">
                  {!showInviteForm ? (
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      הזמן משתמש חדש
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-petra-muted uppercase tracking-wider">
                          הזמנת משתמש
                        </h4>
                        <button
                          onClick={() => {
                            setShowInviteForm(false);
                            setInviteError("");
                          }}
                          className="text-xs text-petra-muted hover:text-petra-text"
                        >
                          ביטול
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="שם"
                        value={inviteData.name}
                        onChange={(e) =>
                          setInviteData((d) => ({ ...d, name: e.target.value }))
                        }
                        className="w-full text-sm bg-slate-50 border border-petra-border rounded-xl px-3 py-2 text-petra-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      />
                      <input
                        type="email"
                        placeholder="אימייל"
                        dir="ltr"
                        value={inviteData.email}
                        onChange={(e) =>
                          setInviteData((d) => ({ ...d, email: e.target.value }))
                        }
                        className="w-full text-sm bg-slate-50 border border-petra-border rounded-xl px-3 py-2 text-petra-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      />
                      <input
                        type="password"
                        placeholder="סיסמה זמנית (לפחות 8 תווים)"
                        dir="ltr"
                        value={inviteData.temporaryPassword}
                        onChange={(e) =>
                          setInviteData((d) => ({
                            ...d,
                            temporaryPassword: e.target.value,
                          }))
                        }
                        className="w-full text-sm bg-slate-50 border border-petra-border rounded-xl px-3 py-2 text-petra-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      />
                      <select
                        value={inviteData.role}
                        onChange={(e) =>
                          setInviteData((d) => ({ ...d, role: e.target.value }))
                        }
                        className="w-full text-sm bg-slate-50 border border-petra-border rounded-xl px-3 py-2 text-petra-text cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {inviteError && (
                        <p className="text-xs text-red-600">{inviteError}</p>
                      )}
                      <button
                        onClick={() => {
                          if (
                            !inviteData.email ||
                            !inviteData.name ||
                            !inviteData.temporaryPassword
                          ) {
                            setInviteError("נא למלא את כל השדות");
                            return;
                          }
                          if (inviteData.temporaryPassword.length < 8) {
                            setInviteError("סיסמה חייבת להכיל לפחות 8 תווים");
                            return;
                          }
                          setInviteError("");
                          inviteMember.mutate(inviteData);
                        }}
                        disabled={inviteMember.isPending}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors"
                      >
                        {inviteMember.isPending ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            הזמן
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
