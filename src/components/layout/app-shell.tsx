"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { type ReactNode, useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/providers/auth-provider";
import { LimitReachedModal } from "@/components/paywall/LimitReachedModal";
import { PWAInstallProvider } from "./PWAInstallProvider";
import { PullToRefresh } from "./PullToRefresh";
import { ScreenGuard } from "./ScreenGuard";

const HelpCenter = dynamic(
  () => import("@/components/help/HelpCenter").then((m) => ({ default: m.HelpCenter })),
  { ssr: false }
);

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fix #5: Auto-collapse sidebar on tablet (768px–1024px)
  useEffect(() => {
    const check = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [helpOpen, setHelpOpen] = useState(false);
  const { user, exitImpersonation } = useAuth();
  return (
    <PWAInstallProvider>
    <div className="min-h-screen" data-petra-shell={collapsed ? "collapsed" : "open"}>
      {/* Impersonation banner */}
      {user?.isImpersonating && (
        <div className="bg-red-600 text-white text-sm px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
          <span className="flex items-center gap-2">
            ⚠️ מצב התחזות — עסק: <strong>{user.businessName}</strong>
          </span>
          <button
            onClick={exitImpersonation}
            className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5"
          >
            ← חזרה ל-Master Admin
          </button>
        </div>
      )}

      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onHelpOpen={() => setHelpOpen(true)}
      />
      <div
        className={[
          "transition-all duration-300",
          "mr-0",
          collapsed ? "md:mr-[72px]" : "md:mr-[240px]",
        ].join(" ")}
      >
        <Topbar onMenuToggle={() => setMobileOpen((prev) => !prev)} />
        <PullToRefresh />
        <main id="main-content" tabIndex={-1} className="p-4 md:p-6 overflow-x-clip"><ScreenGuard>{children}</ScreenGuard></main>
        <div className="no-print"><MobileBottomNav /></div>
      </div>

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-24 left-3 sm:bottom-6 sm:left-6 z-40 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all flex items-center justify-center opacity-90 sm:opacity-100"
        aria-label="מרכז עזרה"
      >
        <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <HelpCenter open={helpOpen} onOpenChange={setHelpOpen} />
      <LimitReachedModal />
    </div>
    </PWAInstallProvider>
  );
}
