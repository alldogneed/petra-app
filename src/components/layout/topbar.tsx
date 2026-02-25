"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { GlobalSearch } from "@/components/search/global-search";
import { cn, fetchJSON, formatCurrency } from "@/lib/utils";

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
  "/bookings": { title: "הזמנות", subtitle: "הזמנות אונליין" },
  "/analytics": { title: "אנליטיקס", subtitle: "סטטיסטיקות ונתוני ביצוע" },
  "/orders": { title: "הזמנות", subtitle: "ניהול הזמנות" },
  "/pricing": { title: "מחירון", subtitle: "ניהול מחירים" },
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

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Close panel on route change
  useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  // Integrations query — only when panel is open
  const { data: integrations } = useQuery<IntegrationStatus[]>({
    queryKey: ["integrations"],
    queryFn: () => fetchJSON("/api/integrations"),
    enabled: profileOpen,
    staleTime: 60000,
  });

  // Dashboard summary — uses React Query cache from dashboard page
  const { data: dashData } = useQuery<DashboardSummary>({
    queryKey: ["dashboard"],
    queryFn: () => fetchJSON("/api/dashboard"),
    enabled: profileOpen,
    staleTime: 30000,
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
          <div className="hidden lg:flex flex-col min-w-0 ml-2">
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
        <div className="flex-1 max-w-xs md:max-w-sm">
          <GlobalSearch />
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-1 mr-auto">
          <div className="w-px h-6 bg-slate-200 mx-2" />
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

          {/* Panel - slides from right in RTL */}
          <div
            className={cn(
              "absolute top-0 right-0 h-full w-[320px] max-w-full bg-white shadow-2xl",
              "transition-transform duration-300 ease-out",
              "flex flex-col overflow-y-auto"
            )}
          >
            {/* Close button */}
            <button
              onClick={() => setProfileOpen(false)}
              className="absolute top-4 left-4 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
          </div>
        </div>
      )}
    </>
  );
}
