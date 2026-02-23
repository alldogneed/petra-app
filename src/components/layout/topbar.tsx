"use client";

import { ChevronDown, Menu, LogOut } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { GlobalSearch } from "@/components/search/global-search";

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
};

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const pageKey = Object.keys(PAGE_TITLES).find((key) =>
    pathname.startsWith(key)
  );
  const pageInfo = pageKey ? PAGE_TITLES[pageKey] : null;

  const displayName = user?.name || "משתמש";
  const initials = displayName.charAt(0);
  const roleLabel = user?.platformRole === "super_admin"
    ? "מנהל על"
    : user?.platformRole === "admin"
    ? "מנהל מערכת"
    : user?.businessRole === "owner"
    ? "בעל עסק"
    : user?.businessRole === "manager"
    ? "מנהל"
    : "משתמש";

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-4 md:px-6 gap-3 md:gap-4"
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

      {/* User avatar & menu */}
      <div className="flex items-center gap-1 mr-auto relative">
        <div className="w-px h-6 bg-slate-200 mx-2" />
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-all duration-150 group"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)" }}
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
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block group-hover:text-slate-600 transition-colors" />
        </button>

        {/* Dropdown */}
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-modal border border-petra-border py-1 min-w-[180px] animate-scale-in">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-petra-text">{displayName}</p>
                <p className="text-xs text-petra-muted">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                התנתק
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
