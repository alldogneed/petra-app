"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { type ReactNode, useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { LimitReachedModal } from "@/components/paywall/LimitReachedModal";

const TIER_LABEL: Record<string, string> = {
  basic: "בייסיק",
  pro: "פרו",
  groomer: "גרומר+",
  service_dog: "Service Dog",
};

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
  const { trialActive, trialExpired, trialDaysLeft, tier } = usePlan();

  return (
    <div className="min-h-screen">
      {/* Impersonation banner */}
      {user?.isImpersonating && (
        <div className="bg-red-600 text-white text-sm px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
          <span className="flex items-center gap-2">
            ⚠️ מצב התחזות — עסק: <strong>{user.businessName}</strong>
          </span>
          <button
            onClick={exitImpersonation}
            className="underline font-semibold hover:text-red-100 transition-colors"
          >
            יציאה מהתחזות ←
          </button>
        </div>
      )}
      {/* Trial active banner */}
      {trialActive && !user?.isImpersonating && (
        <div className="bg-amber-400 text-amber-950 text-sm px-4 py-2 flex items-center justify-between sticky top-0 z-50">
          <span>
            נשארו <strong>{trialDaysLeft} ימים</strong> בניסיון החינמי של מסלול{" "}
            <strong>{TIER_LABEL[tier] ?? tier}</strong>
          </span>
          <a href="/upgrade" className="underline font-semibold hover:text-amber-800 transition-colors">
            שלם עכשיו ←
          </a>
        </div>
      )}

      {/* Trial expired banner */}
      {trialExpired && !user?.isImpersonating && (
        <div className="bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-between sticky top-0 z-50">
          <span>הניסיון שלך פג — עבור למסלול בתשלום כדי להמשיך</span>
          <a href="/upgrade" className="underline font-semibold hover:text-red-100 transition-colors">
            שדרג עכשיו ←
          </a>
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
        <main id="main-content" tabIndex={-1} className="p-4 md:p-6 overflow-x-hidden">{children}</main>
        <MobileBottomNav />
      </div>

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-28 left-4 sm:bottom-6 sm:left-6 z-40 w-11 h-11 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all flex items-center justify-center"
        aria-label="מרכז עזרה"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      <HelpCenter open={helpOpen} onOpenChange={setHelpOpen} />
      <LimitReachedModal />
    </div>
  );
}
