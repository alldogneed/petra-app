"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { type ReactNode, useState } from "react";
import { HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useAuth } from "@/providers/auth-provider";

const HelpCenter = dynamic(
  () => import("@/components/help/HelpCenter").then((m) => ({ default: m.HelpCenter })),
  { ssr: false }
);

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { user, exitImpersonation } = useAuth();

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
        <main className="p-4 md:p-6 overflow-x-hidden">{children}</main>
        <MobileBottomNav />
      </div>

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-40 w-11 h-11 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-all flex items-center justify-center"
        aria-label="מרכז עזרה"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      <HelpCenter open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
